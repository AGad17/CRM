import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  permissions: true,
  isActive: true,
  createdAt: true,
}

export async function getUsers() {
  return prisma.user.findMany({
    select: USER_SELECT,
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
      permissions: {},
      isActive: true,
    },
    select: USER_SELECT,
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
    select: USER_SELECT,
  })
}

/**
 * Save per-module permission overrides for a user.
 * `overrides` is a partial permissions map, e.g.:
 *   { accounts: { create: false }, pipeline: { admin: true } }
 * Modules not mentioned in overrides keep their role defaults.
 * Pass {} to reset all overrides (restore pure role defaults).
 */
export async function updateUserPermissions(id, overrides) {
  return prisma.user.update({
    where: { id },
    data: { permissions: overrides },
    select: USER_SELECT,
  })
}

export async function deleteUser(id) {
  return prisma.user.delete({ where: { id } })
}
