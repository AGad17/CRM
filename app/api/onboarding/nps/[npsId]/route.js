import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { completeNps } from '@/lib/db/onboarding'

// PATCH /api/onboarding/nps/:npsId  — record score & mark complete
export async function PATCH(request, { params }) {
  const { error } = await requirePermission('onboarding', 'edit')
  if (error) return error

  const { npsId } = await params
  const body = await request.json()

  try {
    const record = await completeNps(npsId, {
      score: body.score != null ? Number(body.score) : undefined,
      notes: body.notes,
    })
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
