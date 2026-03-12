import { NextResponse } from 'next/server'
import { getNRRBreakdown } from '@/lib/db/analytics'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const filters = {}
  const country = searchParams.get('country')
  const leadSource = searchParams.get('leadSource')
  if (country) filters.country = country
  if (leadSource) filters.leadSource = leadSource
  const data = await getNRRBreakdown(filters)
  return NextResponse.json(data)
}
