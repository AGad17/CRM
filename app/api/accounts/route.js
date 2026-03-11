import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'
import { getAccounts } from '@/lib/db/accounts'

export async function GET(request) {
  const { error } = await requireAuth('read')
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
        leads:            { select: { stage: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    })
    const active = accounts.filter((a) => {
      const lastLead = a.leads[0]
      return !lastLead || lastLead.stage !== 'Churned'
    })
    return NextResponse.json(active)
  }

  // Default → full enriched list for the Accounts page
  const filters = {
    country:    searchParams.get('country')    || undefined,
    leadSource: searchParams.get('leadSource') || undefined,
  }
  const accounts = await getAccounts(filters)
  return NextResponse.json(accounts)
}
