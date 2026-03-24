import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { completeCsat } from '@/lib/db/onboarding'

// PATCH /api/onboarding/csat/:csatId  — record score & mark complete
export async function PATCH(request, { params }) {
  const { error } = await requirePermission('onboarding', 'edit')
  if (error) return error

  const { csatId } = await params
  const body = await request.json()

  try {
    const record = await completeCsat(csatId, {
      score: body.score != null ? Number(body.score) : undefined,
      notes: body.notes,
    })
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
