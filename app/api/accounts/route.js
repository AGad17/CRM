import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getAccounts, createAccount } from '@/lib/db/accounts'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {
    country: searchParams.get('country') || undefined,
    leadSource: searchParams.get('leadSource') || undefined,
  }

  const accounts = await getAccounts(filters)
  return NextResponse.json(accounts)
}

export async function POST(request) {
  const { error } = await requireAuth('write')
  if (error) return error

  const body = await request.json()

  if (!body.name || !body.leadSource || !body.country) {
    return NextResponse.json({ error: 'name, leadSource, and country are required' }, { status: 400 })
  }

  const account = await createAccount({
    name: body.name,
    leadSource: body.leadSource,
    country: body.country,
    brands: Number(body.brands) || 1,
    numberOfBranches: Number(body.numberOfBranches) || 1,
    numberOfCostCentres: body.numberOfCostCentres ? Number(body.numberOfCostCentres) : null,
  })

  return NextResponse.json(account, { status: 201 })
}
