import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { seedQuarterlyNps, currentQuarter } from '@/lib/db/onboarding'

// POST /api/onboarding/nps-seed
// Seeds NPS records for the current (or a provided) quarter for all
// Incubation + AccountManagement accounts. Safe to call multiple times.
export async function POST(request) {
  const { error } = await requireAuth('ops')
  if (error) return error

  try {
    const body    = await request.json().catch(() => ({}))
    const quarter = body.quarter || currentQuarter()
    const result  = await seedQuarterlyNps(quarter)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[nps-seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
