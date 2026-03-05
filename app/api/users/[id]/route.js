import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updateUser, deleteUser } from '@/lib/db/users'

export async function PUT(request, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const body = await request.json()
  const user = await updateUser(params.id, body)
  return NextResponse.json(user)
}

export async function DELETE(_, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  await deleteUser(params.id)
  return NextResponse.json({ success: true })
}
