import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'

// GET /api/users/staff
// Returns active users for assignment dropdowns.
// Requires only read-level auth so ops pages can populate selects.
export async function GET() {
  const { error } = await requirePermission('onboarding', 'view')
  if (error) return error

  const users = await prisma.user.findMany({
    where:   { isActive: true },
    select:  { id: true, name: true, email: true, role: true, customRole: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}
