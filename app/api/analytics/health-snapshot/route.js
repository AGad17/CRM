import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { snapshotHealthScores } from '@/lib/db/analytics'

// POST: trigger a snapshot run (called from the account-health page)
export async function POST() {
  const { error } = await requireAuth('read')
  if (error) return error

  const result = await snapshotHealthScores()
  return NextResponse.json(result)
}
