import { NextResponse } from 'next/server'
import { getMRRWaterfall } from '@/lib/db/analytics'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const leadSources = searchParams.get('leadSources')?.split(',').filter(Boolean) || []
  const filters = {}
  if (searchParams.get('country')) filters.country = searchParams.get('country')
  if (leadSources.length > 0) filters.leadSources = leadSources
  const data = await getMRRWaterfall(filters)
  return NextResponse.json(data)
}
