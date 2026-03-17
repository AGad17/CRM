/**
 * SERVER-ONLY role guard utilities.
 * Do NOT import this in 'use client' components — use lib/permissionsConfig.js instead.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'
import {
  MODULES,
  ACTIONS,
  ROLE_DEFAULTS,
  resolvePermissions,
  hasPermission,
} from './permissionsConfig'

// Re-export everything from permissionsConfig so existing server-side imports still work
export { MODULES, ACTIONS, ROLE_DEFAULTS, resolvePermissions, hasPermission }

// ─── Roles ────────────────────────────────────────────────────────────────────

export const ROLES = {
  CCO_ADMIN:        'CCO_ADMIN',
  REVENUE_MANAGER:  'REVENUE_MANAGER',
  CUSTOMER_SUCCESS: 'CUSTOMER_SUCCESS',
  READ_ONLY:        'READ_ONLY',
}

// ─── Server-side Guards ───────────────────────────────────────────────────────

/**
 * Granular server-side guard — checks module + action against session.
 * Usage: const { error, session } = await requirePermission('accounts', 'edit')
 */
export async function requirePermission(module, action) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!hasPermission(session, module, action)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}

// ─── Legacy Guard (backward compat) ──────────────────────────────────────────
// Old broad-permission levels — kept so existing routes don't break.
// New routes should prefer requirePermission(module, action).

export const PERMISSIONS = {
  read:   [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER, ROLES.CUSTOMER_SUCCESS, ROLES.READ_ONLY],
  write:  [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER],
  ops:    [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER, ROLES.CUSTOMER_SUCCESS],
  delete: [ROLES.CCO_ADMIN],
  export: [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER, ROLES.CUSTOMER_SUCCESS, ROLES.READ_ONLY],
}

/**
 * Legacy role-only guard — does NOT respect per-user permission overrides.
 * Kept for backward compatibility. Prefer requirePermission() for new code.
 */
export async function requireAuth(permission = 'read') {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const allowed = PERMISSIONS[permission] || PERMISSIONS.read
  if (!allowed.includes(session.user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}
