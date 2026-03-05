import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updateContractItem, deleteContractItem } from '@/lib/db/contracts'

export async function PUT(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const body = await request.json()
  const contract = await updateContractItem(params.id, params.itemId, body)
  return NextResponse.json(contract)
}

export async function DELETE(_, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const contract = await deleteContractItem(params.id, params.itemId)
  return NextResponse.json(contract)
}
