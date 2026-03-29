import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getChurnedAccounts } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requirePermission('analytics', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {}
  if (searchParams.get('country'))     filters.country     = searchParams.get('country')
  if (searchParams.get('type'))        filters.type        = searchParams.get('type')   // 'churned'|'expired'|''
  if (searchParams.get('from'))        filters.from        = searchParams.get('from')
  if (searchParams.get('to'))          filters.to          = searchParams.get('to')
  const ls = searchParams.get('leadSources')
  if (ls) filters.leadSources = ls.split(',').filter(Boolean)

  return NextResponse.json(await getChurnedAccounts(filters))
}
