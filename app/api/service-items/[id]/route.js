import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { updateServiceItem, deleteServiceItem } from '@/lib/db/serviceItems'

export async function PUT(request, { params }) {
  const { error } = await requirePermission('pipeline', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const item = await updateServiceItem(id, body)
  return NextResponse.json(item)
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('pipeline', 'edit')
  if (error) return error

  const { id } = await params
  const item = await deleteServiceItem(id)
  return NextResponse.json(item)
}
