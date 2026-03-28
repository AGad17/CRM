import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAuth } from '@/lib/roleGuard'
import { updateUser, deleteUser } from '@/lib/db/users'
import { prisma } from '@/lib/prisma'

const OWNER_EMAIL = 'a.gad@shopbrain.co'

export async function PUT(request, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  // Protect owner account — role and active status cannot be changed
  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } })
  if (target?.email === OWNER_EMAIL) {
    delete body.role
    delete body.isActive
    delete body.customRoleId
  }

  // When assigning a custom role to a CCO_ADMIN, auto-demote them to READ_ONLY
  const updateData = { ...body }
  if ('customRoleId' in updateData && updateData.customRoleId) {
    if (target?.role === 'CCO_ADMIN') {
      updateData.role = 'READ_ONLY'
    }
  }

  const user = await updateUser(id, updateData)
  return NextResponse.json(user)
}

export async function DELETE(_, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const session = await getServerSession(authOptions)
  const { id } = await params

  if (session?.user?.id === id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }

  // Protect owner account from deletion
  const target = await prisma.user.findUnique({ where: { id }, select: { email: true } })
  if (target?.email === OWNER_EMAIL) {
    return NextResponse.json({ error: 'This account is protected and cannot be deleted.' }, { status: 403 })
  }

  await deleteUser(id)
  return NextResponse.json({ success: true })
}
