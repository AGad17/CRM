import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getSurveysData } from '@/lib/db/surveys'

// GET /api/surveys — all CSAT + NPS records with stats
export async function GET() {
  const { error } = await requireAuth('read')
  if (error) return error

  try {
    const data = await getSurveysData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[surveys GET]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
