import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'

// GET /api/users/staff
// Returns active staff users (non-READ_ONLY) for assignment dropdowns.
// Requires only read-level auth so ops pages can populate selects.
export async function GET() {
  const { error } = await requireAuth('read')
  if (error) return error

  const users = await prisma.user.findMany({
    where:   { isActive: true, role: { not: 'READ_ONLY' } },
    select:  { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}
