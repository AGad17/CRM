import { NextResponse }    from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { prisma }            from '@/lib/prisma'
import { getServerSession }  from 'next-auth'
import { authOptions }       from '@/lib/auth'

const PHASE_LABELS = {
  DealClosure:       'Deal Closure',
  Onboarding:        'Onboarding',
  Training:          'Training',
  Incubation:        'Incubation',
  AccountManagement: 'Account Mgmt',
  Expired:           'Expired',
}

/**
 * GET /api/onboarding/tasks-pending
 * Returns incomplete OnboardingTask records for active trackers, normalized
 * to the same shape used by the Tasks page.
 *
 * Query params (mirrors /api/tasks):
 *   assignedToId  – scope to a specific specialist
 *   all=1         – admin: include all trackers regardless of specialist
 */
export async function GET(request) {
  const { error } = await requirePermission('tasks', 'view')
  if (error) return error

  const session  = await getServerSession(authOptions)
  const userId   = session?.user?.id
  const isAdmin  = session?.user?.role === 'CCO_ADMIN'

  const { searchParams } = new URL(request.url)
  const filterUserId = searchParams.get('assignedToId') || null
  const all          = searchParams.get('all') === '1'

  // Determine whose trackers to include
  const targetId = (isAdmin && all && !filterUserId) ? null : (filterUserId || userId)

  const trackerWhere = { phase: { notIn: ['Churned'] } }
  if (targetId) {
    trackerWhere.OR = [
      { onboardingSpecialistId: targetId },
      { trainingSpecialistId:   targetId },
      { accountManagerId:       targetId },
    ]
  }

  const trackers = await prisma.onboardingTracker.findMany({
    where: trackerWhere,
    include: {
      account:              { select: { id: true, name: true } },
      tasks:                { where: { completed: false } },
      onboardingSpecialist: { select: { id: true, name: true, email: true } },
      trainingSpecialist:   { select: { id: true, name: true, email: true } },
      accountManager:       { select: { id: true, name: true, email: true } },
    },
  })

  const results = []

  for (const tracker of trackers) {
    const phaseStart = new Date(tracker.phaseStartedAt)

    // Phase-responsible specialist
    const specialist =
      tracker.phase === 'Training'
        ? tracker.trainingSpecialist
        : ['DealClosure', 'AccountManagement', 'Expired'].includes(tracker.phase)
          ? tracker.accountManager
          : tracker.onboardingSpecialist  // Onboarding + Incubation

    for (const task of tracker.tasks) {
      // Only tasks belonging to the tracker's current phase
      if (task.phase !== tracker.phase) continue

      const dueDate = task.dueDate
        ? new Date(task.dueDate)
        : task.dueDays != null
          ? new Date(phaseStart.getTime() + task.dueDays * 86_400_000)
          : null

      results.push({
        id:             `ob-${task.id}`,
        source:         'onboarding',
        title:          task.title,
        dueDate:        dueDate?.toISOString() || null,
        status:         'Open',
        type:           'Onboarding',
        assignedToId:   specialist?.id    || null,
        assignedTo:     specialist ? { id: specialist.id, name: specialist.name || specialist.email } : null,
        createdById:    null,
        account:        tracker.account,
        accountId:      tracker.accountId,
        lead:           null,
        leadId:         null,
        case:           null,
        caseId:         null,
        notes:          null,
        completedAt:    null,
        completedNotes: null,
        phase:          tracker.phase,
        phaseLabel:     PHASE_LABELS[tracker.phase] || tracker.phase,
        trackerId:      tracker.id,
      })
    }
  }

  // Sort: tasks with a due date first (ascending), then tasks without
  results.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate) - new Date(b.dueDate)
  })

  return NextResponse.json(results)
}
