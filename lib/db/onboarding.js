import { prisma } from '@/lib/prisma'

export const PHASE_ORDER = ['WelcomeCall', 'Onboarding', 'Training', 'Incubation', 'Active']

export const PHASE_LABELS = {
  WelcomeCall: 'Welcome Call',
  Onboarding:  'Onboarding',
  Training:    'Training',
  Incubation:  'Incubation',
  Active:      'Active',
}

// Default tasks seeded for every new tracker
const DEFAULT_TASKS_MAP = {
  WelcomeCall: [
    'Schedule welcome call',
    'Send welcome email with login credentials',
    'Confirm key contacts (Project Manager + IT)',
    'Review contract scope and go-live timeline',
  ],
  Onboarding: [
    'Collect branch data (names and addresses)',
    'POS hardware installed at all branches',
    'Menu and products configured in system',
    'Initial data migration completed',
    'Assign dedicated onboarding specialist',
  ],
  Training: [
    'Cashier training completed at all branches',
    'Manager dashboard training completed',
    'Head office analytics training completed',
    'Training sign-off received from account',
    'Training materials shared with account',
  ],
  Incubation: [
    'All branches live and processing transactions',
    'First weekly check-in call completed',
    'Critical issues resolved',
    'Second weekly check-in call completed',
    'Transaction data reviewed and healthy',
  ],
  Active: [
    'Account fully live and stable',
    'Handoff to Customer Success team',
    'First QBR scheduled',
    'Support channel established',
  ],
}

// Flat array of {phase, title} for seeding via Prisma createMany
export const DEFAULT_TASKS = PHASE_ORDER.flatMap(phase =>
  DEFAULT_TASKS_MAP[phase].map(title => ({ phase, title }))
)

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getOnboardingTrackers(filters = {}) {
  const where = {}
  if (filters.phase) where.phase = filters.phase
  if (filters.accountId) where.accountId = Number(filters.accountId)

  const trackers = await prisma.onboardingTracker.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, countryId: true, country: { select: { name: true } } } },
      deal:    { select: { id: true, package: true, posSystem: true, startDate: true } },
      tasks:   { select: { id: true, phase: true, completed: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return trackers.map(enrichTracker)
}

export async function getOnboardingTracker(id) {
  const tracker = await prisma.onboardingTracker.findUnique({
    where: { id: Number(id) },
    include: {
      account: { select: { id: true, name: true, country: { select: { name: true } } } },
      deal:    { select: { id: true, package: true, posSystem: true, startDate: true, totalMRR: true } },
      tasks:   { orderBy: [{ phase: 'asc' }, { id: 'asc' }] },
    },
  })
  if (!tracker) return null

  // Group tasks by phase
  const tasksByPhase = {}
  for (const phase of PHASE_ORDER) tasksByPhase[phase] = []
  for (const task of tracker.tasks) {
    if (tasksByPhase[task.phase]) tasksByPhase[task.phase].push(task)
  }

  return { ...enrichTracker(tracker), tasksByPhase }
}

function enrichTracker(tracker) {
  const totalTasks     = tracker.tasks.length
  const completedTasks = tracker.tasks.filter(t => t.completed).length
  const currentPhaseTasks = tracker.tasks.filter(t => t.phase === tracker.phase)
  const currentPhaseCompleted = currentPhaseTasks.filter(t => t.completed).length

  const daysInPhase = Math.floor(
    (Date.now() - new Date(tracker.updatedAt || tracker.startDate).getTime()) / 86400000
  )

  return {
    ...tracker,
    phaseLabel: PHASE_LABELS[tracker.phase] || tracker.phase,
    totalTasks,
    completedTasks,
    currentPhaseTasks:      currentPhaseTasks.length,
    currentPhaseCompleted,
    progressPct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    daysInPhase,
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

// tx-aware: pass a Prisma transaction client or the main prisma instance
export async function createOnboardingTracker(tx, data) {
  return tx.onboardingTracker.create({
    data: {
      accountId: data.accountId,
      dealId:    data.dealId,
      startDate: data.startDate || new Date(),
      tasks: { create: DEFAULT_TASKS },
    },
  })
}

export async function advancePhase(id) {
  const tracker = await prisma.onboardingTracker.findUnique({ where: { id: Number(id) } })
  if (!tracker) throw new Error('Tracker not found')

  const idx = PHASE_ORDER.indexOf(tracker.phase)
  if (idx === -1 || idx === PHASE_ORDER.length - 1) {
    throw new Error('Already at final phase')
  }

  const nextPhase = PHASE_ORDER[idx + 1]
  return prisma.onboardingTracker.update({
    where: { id: Number(id) },
    data:  { phase: nextPhase },
  })
}

export async function updateNotes(id, notes) {
  return prisma.onboardingTracker.update({
    where: { id: Number(id) },
    data:  { notes: notes ?? null },
  })
}

export async function toggleTask(taskId) {
  const task = await prisma.onboardingTask.findUnique({ where: { id: Number(taskId) } })
  if (!task) throw new Error('Task not found')

  const nowCompleted = !task.completed
  return prisma.onboardingTask.update({
    where: { id: Number(taskId) },
    data: {
      completed:   nowCompleted,
      completedAt: nowCompleted ? new Date() : null,
    },
  })
}
