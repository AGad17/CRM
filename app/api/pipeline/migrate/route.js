import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { migrateAccountsToLeads } from '@/lib/db/pipeline'

// POST /api/pipeline/migrate
// Admin-only, idempotent one-time migration.
// Creates Lead records for all existing Accounts that don't yet have one.
// Active accounts → ClosedWon | Churned accounts → Churned
export async function POST() {
  const { error, session } = await requireAuth('delete') // CCO_ADMIN only
  if (error) return error

  try {
    const result = await migrateAccountsToLeads(session.user.id)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
