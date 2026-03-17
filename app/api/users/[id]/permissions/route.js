import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updateUserPermissions } from '@/lib/db/users'
import { MODULES, ACTIONS } from '@/lib/roleGuard'

/**
 * PUT /api/users/[id]/permissions
 * Body: { permissions: { module: { action: true|false } } }
 * CCO_ADMIN only — sets per-module permission overrides for a user.
 * Pass {} as permissions to reset all overrides (restore pure role defaults).
 */
export async function PUT(request, { params }) {
  const { error } = await requireAuth('delete') // CCO_ADMIN only
  if (error) return error

  const body = await request.json()
  const overrides = body.permissions ?? {}

  // Sanitise: only keep known modules and actions, only boolean values
  const sanitised = {}
  for (const mod of MODULES) {
    if (overrides[mod] && typeof overrides[mod] === 'object') {
      sanitised[mod] = {}
      for (const action of ACTIONS) {
        if (typeof overrides[mod][action] === 'boolean') {
          sanitised[mod][action] = overrides[mod][action]
        }
      }
      // Drop empty module entries
      if (Object.keys(sanitised[mod]).length === 0) delete sanitised[mod]
    }
  }

  try {
    const user = await updateUserPermissions(params.id, sanitised)
    return NextResponse.json(user)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
