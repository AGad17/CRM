import { prisma } from '@/lib/prisma'

/** List all custom roles with how many users are assigned. */
export async function getRoles() {
  const roles = await prisma.customRole.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { users: true } },
    },
  })
  return roles.map((r) => ({
    id:          r.id,
    name:        r.name,
    description: r.description,
    permissions: r.permissions,
    userCount:   r._count.users,
    createdAt:   r.createdAt,
    updatedAt:   r.updatedAt,
  }))
}

/** Get a single custom role by id. */
export async function getRoleById(id) {
  return prisma.customRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })
}

/** Create a new custom role. */
export async function createRole({ name, description, permissions = {} }) {
  const existing = await prisma.customRole.findUnique({ where: { name } })
  if (existing) throw new Error(`A role named "${name}" already exists.`)

  return prisma.customRole.create({
    data: { name: name.trim(), description: description?.trim() || null, permissions },
  })
}

/** Update an existing custom role. */
export async function updateRole(id, { name, description, permissions }) {
  const data = {}
  if (name !== undefined)        data.name        = name.trim()
  if (description !== undefined) data.description = description?.trim() || null
  if (permissions !== undefined) data.permissions = permissions

  return prisma.customRole.update({ where: { id }, data })
}

/**
 * Delete a custom role.
 * Fails if any users are still assigned — caller must reassign or unassign first.
 */
export async function deleteRole(id) {
  const count = await prisma.user.count({ where: { customRoleId: id } })
  if (count > 0) {
    throw new Error(`Cannot delete: ${count} user${count > 1 ? 's are' : ' is'} still assigned this role. Unassign them first.`)
  }
  return prisma.customRole.delete({ where: { id } })
}
