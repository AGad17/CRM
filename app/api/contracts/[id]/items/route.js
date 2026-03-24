import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getContractById, addContractItem } from '@/lib/db/contracts'

export async function GET(_, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const contract = await getContractById(params.id)
  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contract.items || [])
}

export async function POST(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const body = await request.json()
  if (!body.description || !body.unitPrice || !body.paymentPlan) {
    return NextResponse.json({ error: 'description, unitPrice, and paymentPlan are required' }, { status: 400 })
  }

  const contract = await addContractItem(params.id, body)
  return NextResponse.json(contract, { status: 201 })
}
