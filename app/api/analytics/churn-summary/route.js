import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getChurnSummary } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requirePermission('analytics', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {}
  if (searchParams.get('country'))     filters.country     = searchParams.get('country')
  const ls = searchParams.get('leadSources')
  if (ls) filters.leadSources = ls.split(',').filter(Boolean)

  return NextResponse.json(await getChurnSummary(filters))
}
