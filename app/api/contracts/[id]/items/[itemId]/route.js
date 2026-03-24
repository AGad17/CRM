import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { updateContractItem, deleteContractItem } from '@/lib/db/contracts'

export async function PUT(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const body = await request.json()
  const contract = await updateContractItem(params.id, params.itemId, body)
  return NextResponse.json(contract)
}

export async function DELETE(_, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const contract = await deleteContractItem(params.id, params.itemId)
  return NextResponse.json(contract)
}
