import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getContractById, updateContract } from '@/lib/db/contracts'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const contract = await getContractById(params.id)
  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contract)
}

export async function PUT(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const body = await request.json()

  if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
    return NextResponse.json({ error: 'endDate must be >= startDate' }, { status: 400 })
  }

  const contract = await updateContract(params.id, body)
  return NextResponse.json(contract)
}
