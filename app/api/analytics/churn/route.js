import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getChurnAnalysis } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error
  const { searchParams } = new URL(request.url)
  const filters = {}
  if (searchParams.get('country'))    filters.country    = searchParams.get('country')
  if (searchParams.get('leadSource')) filters.leadSource = searchParams.get('leadSource')
  return NextResponse.json(await getChurnAnalysis(filters))
}
