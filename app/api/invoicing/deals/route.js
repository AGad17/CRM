import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getDeals } from '@/lib/db/invoicing'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error
  const { searchParams } = new URL(request.url)
  const filters = {
    agentId:     searchParams.get('agentId')     || undefined,
    countryCode: searchParams.get('countryCode') || undefined,
  }
  const deals = await getDeals(filters)
  return NextResponse.json(deals)
}
