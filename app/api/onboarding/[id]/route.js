import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getOnboardingTracker, advancePhase, setPhase, updateNotes, assignAccountManager } from '@/lib/db/onboarding'

export async function GET(request, { params }) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { id } = await params
  const tracker = await getOnboardingTracker(id)
  if (!tracker) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tracker)
}

export async function PATCH(request, { params }) {
  const { error } = await requireAuth('ops')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  try {
    if (body.action === 'advance') {
      const tracker = await advancePhase(id)
      return NextResponse.json(tracker)
    }

    if (body.action === 'setPhase') {
      if (!body.phase) return NextResponse.json({ error: 'phase is required' }, { status: 400 })
      const assignments = {
        onboardingSpecialistId: body.onboardingSpecialistId,
        trainingSpecialistId:   body.trainingSpecialistId,
        accountManagerId:       body.accountManagerId,
      }
      const tracker = await setPhase(id, body.phase, assignments)
      return NextResponse.json(tracker)
    }

    if (body.action === 'notes') {
      const tracker = await updateNotes(id, body.notes)
      return NextResponse.json(tracker)
    }

    if (body.action === 'assign') {
      const tracker = await assignAccountManager(id, body.accountManagerId)
      return NextResponse.json(tracker)
    }

    return NextResponse.json({ error: 'action must be advance, setPhase, assign, or notes' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
