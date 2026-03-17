import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getCohorts } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error
  const { searchParams } = new URL(request.url)
  const leadSources = searchParams.get('leadSources')?.split(',').filter(Boolean) || []
  const filters = {}
  if (searchParams.get('country')) filters.country = searchParams.get('country')
  if (leadSources.length > 0) filters.leadSources = leadSources
  return NextResponse.json(await getCohorts(filters))
}
