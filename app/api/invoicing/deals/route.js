import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getDeals } from '@/lib/db/invoicing'

export async function GET(request) {
  const { error } = await requirePermission('invoicing', 'view')
  if (error) return error
  const { searchParams } = new URL(request.url)
  const filters = {
    agentId:     searchParams.get('agentId')     || undefined,
    countryCode: searchParams.get('countryCode') || undefined,
  }
  const deals = await getDeals(filters)
  return NextResponse.json(deals)
}
