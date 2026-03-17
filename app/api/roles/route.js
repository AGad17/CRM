import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getRoles, createRole } from '@/lib/db/roles'
import { MODULES, ACTIONS } from '@/lib/permissionsConfig'

export async function GET() {
  const { error } = await requireAuth('delete') // CCO_ADMIN only
  if (error) return error
  const roles = await getRoles()
  return NextResponse.json(roles)
}

export async function POST(request) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const body = await request.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Sanitise permissions
  const raw = body.permissions || {}
  const permissions = {}
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

  try {
    const role = await createRole({ name: body.name, description: body.description, permissions })
    return NextResponse.json(role, { status: 201 })
  } catch (e) {
    const status = e.message?.includes('already exists') ? 409 : 400
    return NextResponse.json({ error: e.message }, { status })
  }
}
