import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getContracts, createContract } from '@/lib/db/contracts'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {
    accountId: searchParams.get('accountId') || undefined,
    type: searchParams.get('type') || undefined,
    year: searchParams.get('year') || undefined,
  }

  const contracts = await getContracts(filters)
  return NextResponse.json(contracts)
}

export async function POST(request) {
  const { error } = await requireAuth('write')
  if (error) return error

  const body = await request.json()

  if (!body.accountId || !body.contractValue || !body.startDate || !body.endDate || !body.type) {
    return NextResponse.json({ error: 'accountId, contractValue, startDate, endDate, and type are required' }, { status: 400 })
  }

  if (new Date(body.endDate) < new Date(body.startDate)) {
    return NextResponse.json({ error: 'endDate must be >= startDate' }, { status: 400 })
  }

  if (Number(body.contractValue) <= 0) {
    return NextResponse.json({ error: 'contractValue must be > 0' }, { status: 400 })
  }

  const contract = await createContract(body)
  return NextResponse.json(contract, { status: 201 })
}
