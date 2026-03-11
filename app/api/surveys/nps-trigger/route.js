import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { triggerNpsForTracker } from '@/lib/db/surveys'
import { currentQuarter } from '@/lib/db/onboarding'

// POST /api/surveys/nps-trigger
// Body: { trackerId, quarter? }
// Idempotent — returns existing record if one already exists for this quarter.
export async function POST(request) {
  const { error } = await requireAuth('ops')
  if (error) return error

  const body = await request.json()
  if (!body.trackerId) {
    return NextResponse.json({ error: 'trackerId is required' }, { status: 400 })
  }

  try {
    const quarter = body.quarter || currentQuarter()
    const record  = await triggerNpsForTracker(body.trackerId, quarter)
    return NextResponse.json(record)
  } catch (err) {
    console.error('[nps-trigger]', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
