import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getAccountById, updateAccount } from '@/lib/db/accounts'

export async function GET(request, { params }) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { id } = await params
  const account = await getAccountById(id)
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(account)
}

export async function PUT(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const data = {}
  if (body.name) data.name = body.name
  if (body.leadSource) data.leadSource = body.leadSource
  if (body.country) data.country = body.country
  if (body.brands !== undefined) data.brands = Number(body.brands)
  if (body.numberOfBranches !== undefined) data.numberOfBranches = Number(body.numberOfBranches)
  if (body.numberOfCostCentres !== undefined)
    data.numberOfCostCentres = body.numberOfCostCentres ? Number(body.numberOfCostCentres) : null

  const account = await updateAccount(id, data)
  return NextResponse.json(account)
}
