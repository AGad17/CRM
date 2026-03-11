import { prisma } from '@/lib/prisma'

// ─── Phase definitions ────────────────────────────────────────────────────────

export const PHASE_ORDER = [
  'DealClosure',
  'Onboarding',
  'Training',
  'Incubation',
  'AccountManagement',
]

export const PHASE_LABELS = {
  DealClosure:       'Deal Closure',
  Onboarding:        'Onboarding',
  Training:          'Training',
  Incubation:        'Incubation',
  AccountManagement: 'Account Management',
}

export const PHASE_TEAMS = {
  DealClosure:       'Sales / Account Management',
  Onboarding:        'Onboarding Team',
  Training:          'Onboarding Team',
  Incubation:        'Onboarding Team',
  AccountManagement: 'Customer Success Team',
}

// ─── Default tasks seeded for every new tracker ───────────────────────────────
// Mapped directly from the ShopBrain Customer Journey Plan document.

const DEFAULT_TASKS_MAP = {

  // ── Stage 1: Deal Closure (Sales / Account Management) ──────────────────────
  DealClosure: [
    'Send final proposal to client and secure signed contract',
    'Share SOP document with client and obtain signed acknowledgement',
    'Send post-deal CSAT survey to client (sales experience)',
    'Complete internal handover document (modules, locations, contacts, special requirements)',
    'Send onboarding kickoff introduction email to client (CC: Onboarding team)',
  ],

  // ── Stage 2: Onboarding (Onboarding Team) ───────────────────────────────────
  Onboarding: [
    'Schedule and conduct welcome call; introduce team and confirm contacts and timelines',
    'Send meeting summary and internal notes to client after welcome call',
    'Conduct onboarding planning meeting; define modules, responsibilities and milestones',
    'Share onboarding project plan with client and obtain sign-off',
    'Collect menus, ingredients, suppliers, pricing and cost centre data from client',
    'Collect third-party system access credentials; validate and clean data pack',
    'Configure Inventory, Recipes, Suppliers, Production and Chart of Accounts',
    'Perform test transactions and complete system setup report',
    'Onboarding Lead performs internal QA review (configuration, workflows and testing)',
    'Present final system setup to client and obtain client sign-off',
    'Send post-onboarding CSAT survey to client',
  ],

  // ── Stage 3: Training (Onboarding Team) ─────────────────────────────────────
  Training: [
    'Build training curriculum per module; schedule sessions with client stakeholders',
    'Share training plan with client and obtain approval within 2 working days',
    'Deliver Inventory module training session (complete module checklist)',
    'Deliver Recipes module training session (complete module checklist)',
    'Deliver Accounting module training session (complete module checklist)',
    'Deliver Production module training session (complete module checklist)',
    'Deliver Forecasting module training session (complete module checklist)',
    'Deliver Reports module training session (complete module checklist)',
    'Run post-training assessments and certify key users',
    'Complete go-live readiness checklist (signed by Onboarding Lead and client)',
  ],

  // ── Stage 4: Incubation (Onboarding Team — 2 weeks max) ─────────────────────
  Incubation: [
    'Provide intensive Day 1 go-live support; monitor critical flows and resolve issues',
    'Complete and submit go-live day report (issues and resolutions)',
    'Maintain daily support log and issue tracker',
    'Conduct mid-incubation performance and adoption review (end of Week 1)',
    'Schedule targeted retraining if operational gaps are identified',
    'Hold end-of-week-2 closure call with client',
    'Run final CSAT and readiness checks',
    'Complete and sign incubation closure report and transition checklist',
  ],

  // ── Stage 5: Account Management (Customer Success Team) ─────────────────────
  AccountManagement: [
    'Conduct formal handover meeting (Onboarding Team + CS + client)',
    'Share complete handover pack and meeting notes with Customer Success team',
    'CSR introductory meeting: review client goals, confirm SLAs and set communication cadence',
    'Create account plan with communication schedule',
    'Run first monthly business review with client',
    'Monitor adoption rate, usage metrics and ROI indicators',
    'Identify upsell and cross-sell opportunities; collaborate with Sales team',
    'Initiate renewal conversation ahead of contract end date',
  ],
}

// Flat array of { phase, title } for Prisma createMany
export const DEFAULT_TASKS = PHASE_ORDER.flatMap((phase) =>
  DEFAULT_TASKS_MAP[phase].map((title) => ({ phase, title }))
)

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getOnboardingTrackers(filters = {}) {
  const where = {}
  if (filters.phase)     where.phase     = filters.phase
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
  const totalTasks         = tracker.tasks.length
  const completedTasks     = tracker.tasks.filter((t) => t.completed).length
  const currentPhaseTasks  = tracker.tasks.filter((t) => t.phase === tracker.phase)
  const currentPhaseCompleted = currentPhaseTasks.filter((t) => t.completed).length

  const daysInPhase = Math.floor(
    (Date.now() - new Date(tracker.updatedAt || tracker.startDate).getTime()) / 86400000
  )

  return {
    ...tracker,
    phaseLabel:           PHASE_LABELS[tracker.phase]  || tracker.phase,
    phaseTeam:            PHASE_TEAMS[tracker.phase]   || '',
    totalTasks,
    completedTasks,
    currentPhaseTasks:      currentPhaseTasks.length,
    currentPhaseCompleted,
    progressPct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    daysInPhase,
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// tx-aware: pass a Prisma transaction client or the main prisma instance
export async function createOnboardingTracker(tx, data) {
  return tx.onboardingTracker.create({
    data: {
      accountId: data.accountId,
      dealId:    data.dealId,
      startDate: data.startDate || new Date(),
      tasks:     { create: DEFAULT_TASKS },
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

export async function setPhase(id, phase) {
  if (!PHASE_ORDER.includes(phase)) throw new Error(`Invalid phase: ${phase}`)
  return prisma.onboardingTracker.update({
    where: { id: Number(id) },
    data:  { phase },
  })
}

// Create OnboardingTracker records for every Account that doesn't have one yet.
// Links to the account's most recent deal if available; otherwise creates without a deal.
export async function seedMissingTrackers() {
  const accounts = await prisma.account.findMany({
    where:   { onboarding: null },
    include: { deals: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { id: 'asc' },
  })

  let count = 0
  for (const account of accounts) {
    const deal   = account.deals[0] ?? null
    const dealId = deal?.id ?? null

    // Skip if this deal is already claimed by another tracker
    if (dealId) {
      const existing = await prisma.onboardingTracker.findUnique({ where: { dealId } })
      if (existing) continue
    }

    await prisma.onboardingTracker.create({
      data: {
        accountId: account.id,
        ...(dealId ? { dealId } : {}),
        startDate: new Date(),
        tasks:     { create: DEFAULT_TASKS },
      },
    })
    count++
  }

  return { count }
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
