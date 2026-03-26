import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createNotification,
  notificationExists,
} from '@/lib/db/notifications'

/**
 * Phase 2 — Scheduled notification checks.
 * Triggered daily (Vercel Cron, external cron, or manual from Settings).
 *
 * Protect with CRON_SECRET env var:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Add to vercel.json for daily 8 AM UTC runs:
 *   { "crons": [{ "path": "/api/cron/notifications", "schedule": "0 8 * * *" }] }
 */
export async function POST(request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { renewals: 0, invoices: 0 }

  // ── Renewal Alerts ──────────────────────────────────────────────────────────
  const now = new Date()

  const BUCKETS = [
    { days: 30, type: 'RenewalDue30' },
    { days: 14, type: 'RenewalDue14' },
    { days: 7,  type: 'RenewalDue7'  },
  ]

  for (const { days, type } of BUCKETS) {
    const windowStart = new Date(now)
    windowStart.setDate(windowStart.getDate() + days - 1)
    const windowEnd = new Date(now)
    windowEnd.setDate(windowEnd.getDate() + days + 1)

    const contracts = await prisma.contract.findMany({
      where: {
        cancellationDate: null,
        endDate: { gte: windowStart, lte: windowEnd },
      },
      include: {
        account: {
          include: {
            obTrackers: {
              select: { amTrackerId: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    for (const contract of contracts) {
      const link = `/accounts/${contract.accountId}`
      const title = `Renewal due in ${days} days: ${contract.account?.name}`

      // Determine recipient: account AM, or fall back to all CCO_ADMINs
      let recipientId = contract.account?.obTrackers?.[0]?.amTrackerId
      if (!recipientId) {
        // Notify all CCO_ADMINs
        const admins = await prisma.user.findMany({
          where: { role: 'CCO_ADMIN', isActive: true },
          select: { id: true },
        })
        for (const admin of admins) {
          if (!(await notificationExists(admin.id, type, link))) {
            await createNotification({ userId: admin.id, type, title, link })
            results.renewals++
          }
        }
        continue
      }

      if (!(await notificationExists(recipientId, type, link))) {
        await createNotification({ userId: recipientId, type, title, link })
        results.renewals++
      }
    }
  }

  // ── Overdue Invoice Alerts ──────────────────────────────────────────────────
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: 'Eligible',
      eligibleCollectionDate: { lt: now },
    },
    include: {
      deal: { include: { account: { select: { id: true, name: true } } } },
    },
  })

  // Notify all REVENUE_MANAGERs + CCO_ADMINs
  const receivers = await prisma.user.findMany({
    where: { role: { in: ['REVENUE_MANAGER', 'CCO_ADMIN'] }, isActive: true },
    select: { id: true },
  })

  for (const invoice of overdueInvoices) {
    const accountName = invoice.deal?.account?.name || 'Unknown account'
    const link = `/invoicing/invoices`
    const title = `Invoice overdue: ${accountName} — ${invoice.invoiceNumber}`

    for (const user of receivers) {
      const dedupeKey = `/invoicing/invoices?id=${invoice.id}`
      if (!(await notificationExists(user.id, 'InvoiceOverdue', dedupeKey))) {
        await createNotification({
          userId: user.id,
          type: 'InvoiceOverdue',
          title,
          link,
        })
        results.invoices++
      }
    }
  }

  return NextResponse.json({ success: true, created: results })
}
