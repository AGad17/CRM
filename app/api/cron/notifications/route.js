import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createNotification,
  notificationExists,
} from '@/lib/db/notifications'

/**
 * Scheduled notification checks — runs daily (8 AM UTC recommended).
 * Protect with CRON_SECRET env var: Authorization: Bearer <CRON_SECRET>
 *
 * Covers:
 *  1. Renewal alerts (30 / 14 / 7 days)
 *  2. Overdue invoices
 *  3. Overdue onboarding tasks (per tracker, per phase specialist)
 *  4. Cases with no activity for 7+ days
 */
export async function POST(request) {
  const auth   = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now     = new Date()
  const results = { renewals: 0, invoices: 0, onboardingTasks: 0, cases: 0, caseReminders: 0 }

  // ── Helper: fetch CCO_ADMIN ids (cached per run) ───────────────────────────
  let _adminIds = null
  async function adminIds() {
    if (!_adminIds) {
      const admins = await prisma.user.findMany({
        where: { role: 'CCO_ADMIN', isActive: true },
        select: { id: true },
      })
      _adminIds = admins.map((a) => a.id)
    }
    return _adminIds
  }

  // ── 1. Renewal Alerts ──────────────────────────────────────────────────────
  const BUCKETS = [
    { days: 30, type: 'RenewalDue30' },
    { days: 14, type: 'RenewalDue14' },
    { days: 7,  type: 'RenewalDue7'  },
  ]

  for (const { days, type } of BUCKETS) {
    const windowStart = new Date(now); windowStart.setDate(windowStart.getDate() + days - 1)
    const windowEnd   = new Date(now); windowEnd.setDate(windowEnd.getDate() + days + 1)

    const contracts = await prisma.contract.findMany({
      where: { cancellationDate: null, endDate: { gte: windowStart, lte: windowEnd } },
      include: {
        account: {
          include: {
            onboarding: { select: { accountManagerId: true } },
          },
        },
      },
    })

    for (const contract of contracts) {
      const link  = `/accounts/${contract.accountId}`
      const title = `Renewal due in ${days} days: ${contract.account?.name}`
      const amId  = contract.account?.onboarding?.accountManagerId

      const recipients = amId ? [amId] : await adminIds()
      for (const userId of recipients) {
        if (!(await notificationExists(userId, type, link))) {
          await createNotification({ userId, type, title, link })
          results.renewals++
        }
      }
    }
  }

  // ── 2. Overdue Invoice Alerts ──────────────────────────────────────────────
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: 'Eligible', eligibleCollectionDate: { lt: now } },
    include: { deal: { include: { account: { select: { id: true, name: true } } } } },
  })

  const invoiceReceivers = await prisma.user.findMany({
    where: { role: { in: ['REVENUE_MANAGER', 'CCO_ADMIN'] }, isActive: true },
    select: { id: true },
  })

  for (const invoice of overdueInvoices) {
    const accountName = invoice.deal?.account?.name || 'Unknown account'
    const title       = `Invoice overdue: ${accountName} — ${invoice.invoiceNumber}`
    const dedupeKey   = `/invoicing/invoices?id=${invoice.id}`

    for (const { id: userId } of invoiceReceivers) {
      if (!(await notificationExists(userId, 'InvoiceOverdue', dedupeKey))) {
        await createNotification({ userId, type: 'InvoiceOverdue', title, link: `/invoicing/invoices` })
        results.invoices++
      }
    }
  }

  // ── 3. Onboarding Overdue Task Alerts ──────────────────────────────────────
  // For each active tracker, find overdue incomplete tasks in the current phase.
  // Notify the phase-responsible specialist (+ CCO_ADMINs as fallback).
  const activeTrackers = await prisma.onboardingTracker.findMany({
    where: { phase: { notIn: ['Churned'] } },
    include: {
      account: { select: { id: true, name: true } },
      tasks:   { where: { completed: false } },
    },
  })

  for (const tracker of activeTrackers) {
    // Tasks overdue = dueDate < now  OR  phaseStartedAt + dueDays*days < now
    const phaseStart = new Date(tracker.phaseStartedAt)
    const overdueTasks = tracker.tasks.filter((t) => {
      if (t.phase !== tracker.phase) return false          // only current phase
      const deadline = t.dueDate
        ? new Date(t.dueDate)
        : new Date(phaseStart.getTime() + t.dueDays * 86_400_000)
      return deadline < now
    })

    if (overdueTasks.length === 0) continue

    // Pick the phase-responsible specialist
    const specialistId =
      tracker.phase === 'Training'
        ? tracker.trainingSpecialistId
        : ['DealClosure', 'AccountManagement', 'Expired'].includes(tracker.phase)
          ? tracker.accountManagerId
          : tracker.onboardingSpecialistId  // Onboarding + Incubation

    const recipients  = specialistId ? [specialistId] : await adminIds()
    const link        = `/onboarding/${tracker.id}`
    const dedupeKey   = `${link}?phase=${tracker.phase}`
    const title       = `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} in ${tracker.phase} — ${tracker.account?.name}`
    const body        = overdueTasks.slice(0, 3).map((t) => `• ${t.title}`).join('\n')
                      + (overdueTasks.length > 3 ? `\n…and ${overdueTasks.length - 3} more` : '')

    for (const userId of recipients) {
      if (!(await notificationExists(userId, 'OnboardingTaskOverdue', dedupeKey))) {
        await createNotification({ userId, type: 'OnboardingTaskOverdue', title, body, link })
        results.onboardingTasks++
      }
    }

    // Always also notify admins (if specialist already is an admin, dedup prevents double)
    for (const userId of await adminIds()) {
      if (!(await notificationExists(userId, 'OnboardingTaskOverdue', dedupeKey))) {
        await createNotification({ userId, type: 'OnboardingTaskOverdue', title, body, link })
        results.onboardingTasks++
      }
    }
  }

  // ── 4. Case No-Activity Alerts (7 days) ────────────────────────────────────
  // Open / Escalated cases with no follow-up logged in the last 7 days.
  const staleCutoff = new Date(now.getTime() - 7 * 86_400_000)

  const staleCases = await prisma.engagementCase.findMany({
    where: {
      status: { in: ['Open', 'Escalated'] },
      OR: [
        // Never had a follow-up and opened > 7 days ago
        { followUps: { none: {} }, openedAt: { lt: staleCutoff } },
        // Has follow-ups but the latest was > 7 days ago
        { followUps: { every: { loggedAt: { lt: staleCutoff } } } },
      ],
    },
    include: {
      account: { select: { id: true, name: true } },
    },
  })

  for (const c of staleCases) {
    const link      = `/cases/${c.id}`
    const daysOpen  = Math.floor((now - new Date(c.openedAt)) / 86_400_000)
    const title     = `No activity for 7+ days: "${c.title}"${c.account ? ` — ${c.account.name}` : ''}`
    const body      = `Case has been ${c.status.toLowerCase()} for ${daysOpen} days with no follow-up logged.`

    const recipients = [...new Set([
      c.assignedToId,
      ...(await adminIds()),
    ].filter(Boolean))]

    for (const userId of recipients) {
      if (!(await notificationExists(userId, 'CaseOverdue', link))) {
        await createNotification({ userId, type: 'CaseOverdue', title, body, link })
        results.cases++
      }
    }
  }

  // ── 5. Case Due-Date Reminders ─────────────────────────────────────────────
  // Fires for open/escalated cases with a dueDate:
  //   a) Overdue: dueDate has passed — notify assignee + creator
  //   b) Approaching: (dueDate - reminderHoursBefore) <= now <= dueDate — notify assignee + creator
  const casesWithDueDate = await prisma.engagementCase.findMany({
    where: { status: { in: ['Open', 'Escalated'] }, dueDate: { not: null } },
    include: {
      account:    { select: { id: true, name: true } },
      assignedTo: { select: { name: true } },
    },
  })

  for (const c of casesWithDueDate) {
    const due        = new Date(c.dueDate)
    const link       = `/cases/${c.id}`
    const accountSfx = c.account ? ` — ${c.account.name}` : ''
    const recipients = [...new Set([c.assignedToId, c.openedById].filter(Boolean))]

    if (due < now) {
      // Overdue: past due, case still open
      const dedupeKey = `${link}?overdue=1`
      const title     = `Case overdue: "${c.title}"${accountSfx}`
      const body      = `Due date was ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} — case is still ${c.status.toLowerCase()}.`
      for (const userId of recipients) {
        if (!(await notificationExists(userId, 'CaseReminderDue', dedupeKey))) {
          await createNotification({ userId, type: 'CaseReminderDue', title, body, link })
          results.caseReminders++
        }
      }
    } else if (c.reminderHoursBefore) {
      // Approaching: reminder window has opened
      const reminderAt = new Date(due.getTime() - c.reminderHoursBefore * 3_600_000)
      if (reminderAt <= now) {
        const hoursLeft = Math.max(0, Math.round((due - now) / 3_600_000))
        const dedupeKey = `${link}?reminder=1`
        const title     = `Case due in ${hoursLeft}h: "${c.title}"${accountSfx}`
        const body      = `Due: ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Assigned to ${c.assignedTo?.name || 'Unassigned'}.`
        for (const userId of recipients) {
          if (!(await notificationExists(userId, 'CaseReminderDue', dedupeKey))) {
            await createNotification({ userId, type: 'CaseReminderDue', title, body, link })
            results.caseReminders++
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, created: results })
}
