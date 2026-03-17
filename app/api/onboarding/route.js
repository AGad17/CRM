import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getOnboardingTrackers, createOnboardingTracker, syncExpiredTrackers, DEFAULT_TASKS } from '@/lib/db/onboarding'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const { error } = await requirePermission('onboarding', 'view')
  if (error) return error

  // Auto-advance any active trackers whose account contracts have naturally lapsed
  await syncExpiredTrackers()

  const { searchParams } = new URL(request.url)
  const filters = {
    phase:     searchParams.get('phase')     || undefined,
    accountId: searchParams.get('accountId') || undefined,
  }

  const trackers = await getOnboardingTrackers(filters)
  return NextResponse.json(trackers)
}

export async function POST(request) {
  const { error } = await requirePermission('onboarding', 'create')
  if (error) return error

  const body = await request.json()
  if (!body.accountId || !body.dealId) {
    return NextResponse.json({ error: 'accountId and dealId are required' }, { status: 400 })
  }

  try {
    const tracker = await createOnboardingTracker(prisma, {
      accountId: Number(body.accountId),
      dealId:    Number(body.dealId),
    })
    return NextResponse.json(tracker, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
