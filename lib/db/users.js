import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function getUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createUser(data) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) throw new Error('A user with this email already exists.')

  const hashed = await bcrypt.hash(data.password, 10)
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase().trim(),
      password: hashed,
      role: data.role || 'READ_ONLY',
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })
}

export async function updateUser(id, data) {
  const updates = {}
  if (data.role !== undefined) updates.role = data.role
  if (data.isActive !== undefined) updates.isActive = data.isActive
  if (data.name !== undefined) updates.name = data.name
  if (data.password) updates.password = await bcrypt.hash(data.password, 10)

  return prisma.user.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })
}

export async function deleteUser(id) {
  return prisma.user.delete({ where: { id } })
}
