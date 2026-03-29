import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getChurnSummary } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requirePermission('analytics', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {}

  const cs  = searchParams.get('countries')
  if (cs) filters.countries = cs.split(',').filter(Boolean)

  const ls  = searchParams.get('leadSources')
  if (ls) filters.leadSources = ls.split(',').filter(Boolean)

  const ams = searchParams.get('accountManagerIds')
  if (ams) filters.accountManagerIds = ams.split(',').filter(Boolean)

  if (searchParams.get('from')) filters.from = searchParams.get('from')
  if (searchParams.get('to'))   filters.to   = searchParams.get('to')

  return NextResponse.json(await getChurnSummary(filters))
}
