import { NextResponse } from 'next/server'
import { getAccountHealth } from '@/lib/db/analytics'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const filters = {}
  const country = searchParams.get('country')
  const phase = searchParams.get('phase')
  if (country) filters.country = country
  if (phase) filters.phase = phase
  const data = await getAccountHealth(filters)
  return NextResponse.json(data)
}
