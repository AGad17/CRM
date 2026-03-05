import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getDashboardKPIs } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error
  const { searchParams } = new URL(request.url)
  const filters = {
    country: searchParams.get('country') || undefined,
    leadSource: searchParams.get('leadSource') || undefined,
  }
  return NextResponse.json(await getDashboardKPIs(filters))
}
