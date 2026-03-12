import { NextResponse } from 'next/server'
import { getLeadSourceAnalysis } from '@/lib/db/analytics'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const filters = {}
  const country = searchParams.get('country')
  if (country) filters.country = country
  const data = await getLeadSourceAnalysis(filters)
  return NextResponse.json(data)
}
