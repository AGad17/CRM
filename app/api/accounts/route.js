import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'
import { getAccounts } from '@/lib/db/accounts'

export async function GET(request) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)

  // ?selector=true → lightweight active-only list for the pipeline opportunity picker
  if (searchParams.get('selector') === 'true') {
    const accounts = await prisma.account.findMany({
      select: {
        id:               true,
        name:             true,
        numberOfBranches: true,
        country:          { select: { code: true, name: true, currency: true } },
        leads: {
          select: { stage: true, contactName: true, contactEmail: true, contactPhone: true, channel: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })
    const active = accounts.filter((a) => {
      const lastLead = a.leads[0]
      return !lastLead || lastLead.stage !== 'Churned'
    }).map(({ leads, ...a }) => ({
      ...a,
      contactName:  leads[0]?.contactName  || null,
      contactEmail: leads[0]?.contactEmail || null,
      contactPhone: leads[0]?.contactPhone || null,
      lastChannel:  leads[0]?.channel      || null,
    }))
    return NextResponse.json(active)
  }

  // ?selector=expired → lightweight expired-only list for the Renewal opportunity picker
  // Expired = contract end date has passed with no cancellation (natural expiry, not churned)
  if (searchParams.get('selector') === 'expired') {
    const now = new Date()
    const accounts = await prisma.account.findMany({
      where: {
        // Has at least one naturally expired contract (endDate passed, not cancelled)
        contracts: { some: { cancellationDate: null, endDate: { lt: now } } },
        // No currently active contracts
        NOT: {
          contracts: {
            some: { cancellationDate: null, startDate: { lte: now }, endDate: { gte: now } },
          },
        },
      },
      select: {
        id:               true,
        name:             true,
        numberOfBranches: true,
        country:          { select: { code: true, name: true, currency: true } },
        leads: {
          select: { contactName: true, contactEmail: true, contactPhone: true, channel: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(accounts.map(({ leads, ...a }) => ({
      ...a,
      contactName:  leads[0]?.contactName  || null,
      contactEmail: leads[0]?.contactEmail || null,
      contactPhone: leads[0]?.contactPhone || null,
      lastChannel:  leads[0]?.channel      || null,
    })))
  }

  // ?selector=churned → lightweight churned-only list for the Returning Customer opportunity picker
  if (searchParams.get('selector') === 'churned') {
    const now = new Date()
    const accounts = await prisma.account.findMany({
      where: {
        // Has at least one cancelled contract
        contracts: { some: { cancellationDate: { not: null } } },
        // No currently active contracts
        NOT: {
          contracts: {
            some: { cancellationDate: null, startDate: { lte: now }, endDate: { gte: now } },
          },
        },
      },
      select: {
        id:               true,
        name:             true,
        numberOfBranches: true,
        country:          { select: { code: true, name: true, currency: true } },
        leads: {
          select: { contactName: true, contactEmail: true, contactPhone: true, channel: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(accounts.map(({ leads, ...a }) => ({
      ...a,
      contactName:  leads[0]?.contactName  || null,
      contactEmail: leads[0]?.contactEmail || null,
      contactPhone: leads[0]?.contactPhone || null,
      lastChannel:  leads[0]?.channel      || null,
    })))
  }

  // Default → full enriched list for the Accounts page
  const countriesRaw    = searchParams.get('countries')
  const leadSourcesRaw  = searchParams.get('leadSources')
  const filters = {
    countries:   countriesRaw   ? countriesRaw.split(',').filter(Boolean)   : [],
    leadSources: leadSourcesRaw ? leadSourcesRaw.split(',').filter(Boolean) : [],
  }
  const accounts = await getAccounts(filters)
  return NextResponse.json(accounts)
}
