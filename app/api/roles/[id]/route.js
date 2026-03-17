import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getRoleById, updateRole, deleteRole } from '@/lib/db/roles'
import { MODULES, ACTIONS } from '@/lib/permissionsConfig'

export async function GET(_, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const { id } = await params
  const role = await getRoleById(id)
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(role)
}

export async function PUT(request, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  // Sanitise permissions if provided
  let permissions = undefined
  if (body.permissions !== undefined) {
    const raw = body.permissions || {}
    permissions = {}
    for (const mod of MODULES) {
      if (raw[mod] && typeof raw[mod] === 'object') {
        permissions[mod] = {}
        for (const action of ACTIONS) {
          if (typeof raw[mod][action] === 'boolean') {
            permissions[mod][action] = raw[mod][action]
          }
        }
        if (Object.keys(permissions[mod]).length === 0) delete permissions[mod]
      }
    }
  }

  try {
    const role = await updateRole(id, {
      name:        body.name,
      description: body.description,
      permissions,
    })
    return NextResponse.json(role)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const { id } = await params
  try {
    await deleteRole(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 409 })
  }
}
