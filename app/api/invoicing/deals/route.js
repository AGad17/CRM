import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getDeals, createDeal } from '@/lib/db/invoicing'

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

export async function POST(request) {
  const { error } = await requireAuth('write')
  if (error) return error
  const body = await request.json()

  if (!body.accountName || !body.countryCode || !body.package) {
    return NextResponse.json({ error: 'accountName, countryCode, and package are required' }, { status: 400 })
  }
  if (!body.agentId) {
    return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
  }
  if (!body.startDate) {
    return NextResponse.json({ error: 'startDate is required' }, { status: 400 })
  }

  const deal = await createDeal(body)
  return NextResponse.json(deal, { status: 201 })
}
