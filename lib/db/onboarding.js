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
  Churned:           'Churned',
}

export const PHASE_TEAMS = {
  DealClosure:       'Sales / Account Management',
  Onboarding:        'Onboarding Team',
  Training:          'Onboarding Team',
  Incubation:        'Onboarding Team',
  AccountManagement: 'Customer Success Team',
  Churned:           '—',
}

// ─── Default tasks seeded for every new tracker ───────────────────────────────
// Each task: { phase, title, dueDays, recurring?, recurrenceDays? }
// dueDays = expected completion relative to phaseStartedAt

const DEFAULT_TASKS_MAP = {

  // ── Stage 1: Deal Closure ────────────────────────────────────────────────────
  // Target: complete within 3 days
  DealClosure: [
    { title: 'Send final proposal to client and secure signed contract',                                    dueDays: 1 },
    { title: 'Share SOP document with client and obtain signed acknowledgement',                            dueDays: 2 },
    { title: 'Complete internal handover document (modules, locations, contacts, special requirements)',    dueDays: 3 },
    { title: 'Send onboarding kickoff introduction email to client (CC: Onboarding team)',                  dueDays: 3 },
  ],

  // ── Stage 2: Onboarding ──────────────────────────────────────────────────────
  // Target: complete within 23 days
  Onboarding: [
    { title: 'Schedule and conduct welcome call; introduce team and confirm contacts and timelines',        dueDays: 2  },
    { title: 'Send meeting summary and internal notes to client after welcome call',                        dueDays: 3  },
    { title: 'Conduct onboarding planning meeting; define modules, responsibilities and milestones',        dueDays: 5  },
    { title: 'Share onboarding project plan with client and obtain sign-off',                               dueDays: 7  },
    { title: 'Collect menus, ingredients, suppliers, pricing and cost centre data from client',             dueDays: 10 },
    { title: 'Collect third-party system access credentials; validate and clean data pack',                 dueDays: 12 },
    { title: 'Configure Inventory, Recipes, Suppliers, Production and Chart of Accounts',                  dueDays: 16 },
    { title: 'Perform test transactions and complete system setup report',                                  dueDays: 18 },
    { title: 'Onboarding Lead performs internal QA review (configuration, workflows and testing)',          dueDays: 20 },
    { title: 'Present final system setup to client and obtain client sign-off',                             dueDays: 22 },
  ],

  // ── Stage 3: Training ────────────────────────────────────────────────────────
  // Target: complete within 14 days
  Training: [
    { title: 'Build training curriculum per module; schedule sessions with client stakeholders',            dueDays: 2  },
    { title: 'Share training plan with client and obtain approval within 2 working days',                   dueDays: 4  },
    { title: 'Deliver Inventory module training session (complete module checklist)',                        dueDays: 5  },
    { title: 'Deliver Recipes module training session (complete module checklist)',                          dueDays: 6  },
    { title: 'Deliver Accounting module training session (complete module checklist)',                       dueDays: 7  },
    { title: 'Deliver Production module training session (complete module checklist)',                       dueDays: 8  },
    { title: 'Deliver Forecasting module training session (complete module checklist)',                      dueDays: 9  },
    { title: 'Deliver Reports module training session (complete module checklist)',                          dueDays: 10 },
    { title: 'Run post-training assessments and certify key users',                                         dueDays: 12 },
    { title: 'Complete go-live readiness checklist (signed by Onboarding Lead and client)',                 dueDays: 14 },
  ],

  // ── Stage 4: Incubation ──────────────────────────────────────────────────────
  // Target: complete within 14 days (2-week max)
  Incubation: [
    { title: 'Provide intensive Day 1 go-live support; monitor critical flows and resolve issues',          dueDays: 1  },
    { title: 'Complete and submit go-live day report (issues and resolutions)',                             dueDays: 1  },
    { title: 'Maintain daily support log and issue tracker',                                                dueDays: 7  },
    { title: 'Conduct mid-incubation performance and adoption review (end of Week 1)',                      dueDays: 7  },
    { title: 'Schedule targeted retraining if operational gaps are identified',                             dueDays: 9  },
    { title: 'Hold end-of-week-2 closure call with client',                                                dueDays: 14 },
    { title: 'Run final CSAT and readiness checks',                                                        dueDays: 14 },
    { title: 'Complete and sign incubation closure report and transition checklist',                        dueDays: 14 },
  ],

  // ── Stage 5: Account Management ─────────────────────────────────────────────
  // One-time handover tasks + recurring monthly / quarterly reviews
  AccountManagement: [
    // One-time onboarding handover (first ~10 days)
    { title: 'Conduct formal handover meeting (Onboarding Team + CS + client)',                             dueDays: 3,  recurring: false },
    { title: 'Share complete handover pack and meeting notes with Customer Success team',                   dueDays: 3,  recurring: false },
    { title: 'CSR introductory meeting: review client goals, confirm SLAs and set communication cadence',  dueDays: 7,  recurring: false },
    { title: 'Create account plan with communication schedule',                                             dueDays: 10, recurring: false },
    // Monthly recurring
    { title: 'Monthly business review with client',                                                        dueDays: 30, recurring: true, recurrenceDays: 30 },
    { title: 'Monitor adoption rate, usage metrics and ROI indicators',                                    dueDays: 30, recurring: true, recurrenceDays: 30 },
    // Quarterly recurring
    { title: 'Quarterly performance review with client',                                                   dueDays: 90, recurring: true, recurrenceDays: 90 },
    { title: 'Identify upsell and cross-sell opportunities; collaborate with Sales team',                  dueDays: 90, recurring: true, recurrenceDays: 90 },
  ],
}

// Flat array seeded on tracker creation
export const DEFAULT_TASKS = PHASE_ORDER.flatMap((phase) =>
  DEFAULT_TASKS_MAP[phase].map(({ title, dueDays, recurring = false, recurrenceDays = null }) => ({
    phase, title, dueDays, recurring, recurrenceDays,
  }))
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Current quarter string e.g. "Q2-2026"
export function currentQuarter() {
  const now = new Date()
  const q   = Math.ceil((now.getMonth() + 1) / 3)
  return `Q${q}-${now.getFullYear()}`
}

// Renewal flag: active if contract endDate is within 90 days
function renewalFlag(contracts = []) {
  const now     = Date.now()
  const in90    = now + 90 * 86400000
  const active  = contracts
    .filter(c => !c.cancellationDate && new Date(c.endDate).getTime() > now)
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))

  if (!active.length) return null

  const soonest   = active[0]
  const msLeft    = new Date(soonest.endDate).getTime() - now
  const daysLeft  = Math.ceil(msLeft / 86400000)

  return daysLeft <= 90
    ? { daysLeft, endDate: soonest.endDate, contractId: soonest.id }
    : null
}

// Overdue calculation for a single task
function taskOverdue(task, phaseStartedAt) {
  if (task.completed) return false
  const now = Date.now()
  if (task.dueDate)  return new Date(task.dueDate).getTime() < now
  if (task.dueDays)  return new Date(phaseStartedAt).getTime() + task.dueDays * 86400000 < now
  return false
}

function daysOverdue(task, phaseStartedAt) {
  if (!taskOverdue(task, phaseStartedAt)) return 0
  const now = Date.now()
  const ref = task.dueDate
    ? new Date(task.dueDate).getTime()
    : new Date(phaseStartedAt).getTime() + task.dueDays * 86400000
  return Math.ceil((now - ref) / 86400000)
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getOnboardingTrackers(filters = {}) {
  const where = {}
  if (filters.phase)     where.phase     = filters.phase
  if (filters.accountId) where.accountId = Number(filters.accountId)

  const trackers = await prisma.onboardingTracker.findMany({
    where,
    include: {
      account: {
        select: {
          id: true, name: true, countryId: true,
          country:   { select: { name: true } },
          contracts: { select: { id: true, endDate: true, cancellationDate: true }, orderBy: { endDate: 'asc' } },
        },
      },
      deal:  { select: { id: true, package: true, posSystem: true, startDate: true } },
      tasks: { select: { id: true, phase: true, completed: true, dueDays: true, dueDate: true, recurring: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return trackers.map(enrichTracker)
}

export async function getOnboardingTracker(id) {
  const tracker = await prisma.onboardingTracker.findUnique({
    where: { id: Number(id) },
    include: {
      account: {
        select: {
          id: true, name: true,
          country:   { select: { name: true } },
          contracts: { select: { id: true, endDate: true, startDate: true, cancellationDate: true, type: true }, orderBy: { endDate: 'asc' } },
        },
      },
      deal:        { select: { id: true, package: true, posSystem: true, startDate: true, totalMRR: true } },
      tasks:        { orderBy: [{ phase: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }] },
      noteEntries:  { orderBy: { createdAt: 'asc' } },
      csatRecords:  { orderBy: { createdAt: 'desc' } },
      npsRecords:   { orderBy: { createdAt: 'desc' } },
      onboardingSpecialist: { select: { id: true, name: true, email: true } },
      trainingSpecialist:   { select: { id: true, name: true, email: true } },
      accountManager:       { select: { id: true, name: true, email: true } },
    },
  })
  if (!tracker) return null

  // Group tasks by phase, annotate overdue
  const tasksByPhase = {}
  for (const phase of PHASE_ORDER) tasksByPhase[phase] = []
  for (const task of tracker.tasks) {
    if (tasksByPhase[task.phase]) {
      tasksByPhase[task.phase].push({
        ...task,
        overdue:     taskOverdue(task, tracker.phaseStartedAt),
        daysOverdue: daysOverdue(task, tracker.phaseStartedAt),
      })
    }
  }

  return {
    ...enrichTracker(tracker),
    tasksByPhase,
    noteEntries: tracker.noteEntries,
    csatRecords: tracker.csatRecords,
    npsRecords:  tracker.npsRecords,
  }
}

function enrichTracker(tracker) {
  const totalTasks            = tracker.tasks.length
  const completedTasks        = tracker.tasks.filter((t) => t.completed).length
  const currentPhaseTasks     = tracker.tasks.filter((t) => t.phase === tracker.phase)
  const currentPhaseCompleted = currentPhaseTasks.filter((t) => t.completed).length

  // Count overdue tasks in current phase
  const overdueCount = currentPhaseTasks.filter(
    (t) => !t.completed && taskOverdue(t, tracker.phaseStartedAt)
  ).length

  const daysInPhase = Math.floor(
    (Date.now() - new Date(tracker.phaseStartedAt || tracker.startDate).getTime()) / 86400000
  )

  return {
    ...tracker,
    phaseLabel:             PHASE_LABELS[tracker.phase]  || tracker.phase,
    phaseTeam:              PHASE_TEAMS[tracker.phase]   || '',
    totalTasks,
    completedTasks,
    currentPhaseTasks:      currentPhaseTasks.length,
    currentPhaseCompleted,
    overdueCount,
    progressPct:            totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    daysInPhase,
    renewalFlag:            renewalFlag(tracker.account?.contracts ?? []),
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

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
  if (idx === -1 || idx === PHASE_ORDER.length - 1) throw new Error('Already at final phase')

  const nextPhase = PHASE_ORDER[idx + 1]
  return _doSetPhase(tracker, nextPhase)
}

// assignments: { onboardingSpecialistId?, trainingSpecialistId?, accountManagerId? }
export async function setPhase(id, phase, assignments = {}) {
  const validPhases = [...PHASE_ORDER, 'Churned']
  if (!validPhases.includes(phase)) throw new Error(`Invalid phase: ${phase}`)
  const tracker = await prisma.onboardingTracker.findUnique({ where: { id: Number(id) } })
  if (!tracker) throw new Error('Tracker not found')
  return _doSetPhase(tracker, phase, assignments)
}

// Internal: update phase, reset phaseStartedAt, save assignments, create CSAT record
async function _doSetPhase(tracker, toPhase, assignments = {}) {
  const fromPhase = tracker.phase
  const now       = new Date()

  // Build assignment data — only include keys that are explicitly provided
  const assignData = {}
  if (assignments.onboardingSpecialistId !== undefined) assignData.onboardingSpecialistId = assignments.onboardingSpecialistId || null
  if (assignments.trainingSpecialistId   !== undefined) assignData.trainingSpecialistId   = assignments.trainingSpecialistId   || null
  if (assignments.accountManagerId       !== undefined) assignData.accountManagerId       = assignments.accountManagerId       || null

  const updated = await prisma.onboardingTracker.update({
    where: { id: tracker.id },
    data:  { phase: toPhase, phaseStartedAt: now, ...assignData },
  })

  // Auto-create CSAT on forward transitions within the active pipeline (not Churned)
  const fromIdx = PHASE_ORDER.indexOf(fromPhase)
  const toIdx   = PHASE_ORDER.indexOf(toPhase)
  if (fromPhase !== toPhase && fromIdx >= 0 && toIdx > fromIdx) {
    await prisma.csatRecord.create({
      data: { trackerId: tracker.id, fromPhase, toPhase },
    })
  }

  return updated
}

export async function seedMissingTrackers() {
  const accounts = await prisma.account.findMany({
    where:   { onboarding: null },
    include: {
      deals:     { orderBy: { createdAt: 'desc' }, take: 1 },
      contracts: { select: { cancellationDate: true, endDate: true } },
    },
    orderBy: { id: 'asc' },
  })

  const now = new Date()

  let count = 0
  for (const account of accounts) {
    const deal   = account.deals[0] ?? null
    const dealId = deal?.id ?? null

    if (dealId) {
      const existing = await prisma.onboardingTracker.findUnique({ where: { dealId } })
      if (existing) continue
    }

    // Determine starting phase based on contract status
    const hasActive = account.contracts.some(
      c => !c.cancellationDate && new Date(c.endDate) > now
    )
    const hasAny = account.contracts.length > 0
    const phase = hasActive ? 'AccountManagement' : hasAny ? 'Churned' : 'DealClosure'

    await prisma.onboardingTracker.create({
      data: {
        accountId: account.id,
        ...(dealId ? { dealId } : {}),
        phase,
        startDate: new Date(),
        tasks:     { create: DEFAULT_TASKS },
      },
    })
    count++
  }

  return { count }
}

export async function addNote(trackerId, content, author) {
  return prisma.onboardingNote.create({
    data: {
      trackerId: Number(trackerId),
      content,
      author: author || null,
    },
  })
}

export async function assignAccountManager(id, accountManagerId) {
  return prisma.onboardingTracker.update({
    where: { id: Number(id) },
    data:  { accountManagerId: accountManagerId || null },
  })
}

export async function toggleTask(taskId) {
  const task = await prisma.onboardingTask.findUnique({ where: { id: Number(taskId) } })
  if (!task) throw new Error('Task not found')

  const nowCompleted = !task.completed
  await prisma.onboardingTask.update({
    where: { id: Number(taskId) },
    data: {
      completed:   nowCompleted,
      completedAt: nowCompleted ? new Date() : null,
    },
  })

  // When a recurring task is completed, spawn the next occurrence
  if (nowCompleted && task.recurring && task.recurrenceDays) {
    const nextDue = new Date()
    nextDue.setDate(nextDue.getDate() + task.recurrenceDays)
    await prisma.onboardingTask.create({
      data: {
        trackerId:      task.trackerId,
        phase:          task.phase,
        title:          task.title,
        recurring:      true,
        recurrenceDays: task.recurrenceDays,
        dueDate:        nextDue,
      },
    })
  }

  return prisma.onboardingTask.findUnique({ where: { id: Number(taskId) } })
}

// ─── CSAT ─────────────────────────────────────────────────────────────────────

export async function completeCsat(csatId, { score, notes } = {}) {
  return prisma.csatRecord.update({
    where: { id: Number(csatId) },
    data: {
      score:       score ?? null,
      notes:       notes ?? null,
      completedAt: new Date(),
    },
  })
}

// ─── NPS ──────────────────────────────────────────────────────────────────────

export async function completeNps(npsId, { score, notes } = {}) {
  return prisma.npsRecord.update({
    where: { id: Number(npsId) },
    data: {
      score:       score ?? null,
      notes:       notes ?? null,
      completedAt: new Date(),
    },
  })
}

// Seed NPS records for all Incubation + AccountManagement accounts for a given quarter.
// Safe to call multiple times — @@unique([trackerId, quarter]) prevents duplicates.
export async function seedQuarterlyNps(quarter) {
  const trackers = await prisma.onboardingTracker.findMany({
    where: { phase: { in: ['Incubation', 'AccountManagement'] } },
    select: { id: true, phase: true },
  })

  let count = 0
  for (const t of trackers) {
    try {
      await prisma.npsRecord.create({
        data: { trackerId: t.id, phase: t.phase, quarter },
      })
      count++
    } catch {
      // Duplicate (already seeded for this quarter) — skip silently
    }
  }

  return { count, quarter }
}
