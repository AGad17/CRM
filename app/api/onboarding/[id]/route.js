import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAuth } from '@/lib/roleGuard'
import { getOnboardingTracker, advancePhase, setPhase, addNote, assignAccountManager } from '@/lib/db/onboarding'

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
      if (!body.content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })
      // Capture the author name from the current session
      const session = await getServerSession(authOptions)
      const author  = session?.user?.name || session?.user?.email || null
      const note    = await addNote(id, body.content.trim(), author)
      return NextResponse.json(note)
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
