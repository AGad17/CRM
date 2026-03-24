import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { snapshotHealthScores } from '@/lib/db/analytics'

// POST: trigger a snapshot run (called from the account-health page)
export async function POST() {
  const { error } = await requirePermission('analytics', 'view')
  if (error) return error

  const result = await snapshotHealthScores()
  return NextResponse.json(result)
}
