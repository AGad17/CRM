import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

export const ROLES = {
  CCO_ADMIN: 'CCO_ADMIN',
  REVENUE_MANAGER: 'REVENUE_MANAGER',
  CUSTOMER_SUCCESS: 'CUSTOMER_SUCCESS',
  READ_ONLY: 'READ_ONLY',
}

export const PERMISSIONS = {
  read:   [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER, ROLES.CUSTOMER_SUCCESS, ROLES.READ_ONLY],
  write:  [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER],
  ops:    [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER, ROLES.CUSTOMER_SUCCESS],
  delete: [ROLES.CCO_ADMIN],
  export: [ROLES.CCO_ADMIN, ROLES.REVENUE_MANAGER, ROLES.CUSTOMER_SUCCESS, ROLES.READ_ONLY],
}

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
