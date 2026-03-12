import { NextResponse } from 'next/server'
import { getRenewalPipeline } from '@/lib/db/analytics'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const filters = {}
  const country = searchParams.get('country')
  const leadSource = searchParams.get('leadSource')
  if (country) filters.country = country
  if (leadSource) filters.leadSource = leadSource
  const data = await getRenewalPipeline(filters)
  return NextResponse.json(data)
}
