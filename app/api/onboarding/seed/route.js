import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { seedMissingTrackers, syncExpiredTrackers } from '@/lib/db/onboarding'

// POST /api/onboarding/seed
// Creates OnboardingTracker records for every Account that does not have one yet,
// then auto-advances active trackers to Expired phase when contracts have lapsed.
export async function POST(request) {
  const { error } = await requirePermission('onboarding', 'create')
  if (error) return error

  try {
    const [seeded, synced] = await Promise.all([
      seedMissingTrackers(),
      syncExpiredTrackers(),
    ])
    return NextResponse.json({ created: seeded.count, expiredSynced: synced.synced })
  } catch (err) {
    console.error('[onboarding/seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
