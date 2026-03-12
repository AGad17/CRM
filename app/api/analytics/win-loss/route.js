import { NextResponse } from 'next/server'
import { getWinLoss } from '@/lib/db/analytics'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const filters = {}
  const country = searchParams.get('country')
  if (country) filters.country = country
  const data = await getWinLoss(filters)
  return NextResponse.json(data)
}
