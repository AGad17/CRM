import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { seedMissingTrackers } from '@/lib/db/onboarding'

// POST /api/onboarding/seed
// Creates OnboardingTracker records for every Account that does not have one yet.
export async function POST(request) {
  const { error } = await requireAuth('ops')
  if (error) return error

  try {
    const result = await seedMissingTrackers()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[onboarding/seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
