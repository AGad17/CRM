import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updateUser, deleteUser } from '@/lib/db/users'
import { prisma } from '@/lib/prisma'

export async function PUT(request, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  // CCO_ADMIN cannot be assigned a custom role
  if ('customRoleId' in body && body.customRoleId) {
    const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (existing?.role === 'CCO_ADMIN' || body.role === 'CCO_ADMIN') {
      return NextResponse.json({ error: 'CCO_ADMIN users cannot be assigned a custom role.' }, { status: 400 })
    }
  }

  const user = await updateUser(id, body)
  return NextResponse.json(user)
}

export async function DELETE(_, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const { id } = await params
  await deleteUser(id)
  return NextResponse.json({ success: true })
}
