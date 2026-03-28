import { prisma } from '@/lib/prisma'

// ─── Workload ─────────────────────────────────────────────────────────────────

/**
 * Returns pending tasks, open cases, active leads, and recent deals
 * scoped to a specific user (or all users when userId is null).
 */
export async function getWorkload({ userId, module } = {}) {
  const all = !module || module === 'all'

  // ── Onboarding tasks ──────────────────────────────────────────────────────
  const tasks = (all || module === 'onboarding') ? await prisma.onboardingTask.findMany({
    where: {
      completed: false,
      tracker: {
        phase: { notIn: ['Churned'] },
        ...(userId ? {
          OR: [
            { onboardingSpecialistId: userId },
            { trainingSpecialistId:   userId },
            { accountManagerId:       userId },
          ],
        } : {}),
      },
    },
    include: {
      tracker: {
        select: {
          id: true, phase: true, phaseStartedAt: true,
          account:              { select: { id: true, name: true } },
          onboardingSpecialist: { select: { id: true, name: true } },
          trainingSpecialist:   { select: { id: true, name: true } },
          accountManager:       { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  }) : []

  // Enrich tasks with overdue flag
  const now = Date.now()
  const enrichedTasks = tasks.map((t) => {
    const refMs = t.dueDate
      ? new Date(t.dueDate).getTime()
      : new Date(t.tracker.phaseStartedAt).getTime() + t.dueDays * 86400000
    return { ...t, overdue: refMs < now, dueDateResolved: new Date(refMs) }
  })

  // ── Open cases ────────────────────────────────────────────────────────────
  const cases = (all || module === 'cases') ? await prisma.engagementCase.findMany({
    where: {
      status: { in: ['Open', 'Escalated'] },
      ...(userId ? { assignedToId: userId } : {}),
    },
    include: {
      account:    { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      openedBy:   { select: { id: true, name: true } },
      followUps:  { select: { id: true }, orderBy: { loggedAt: 'desc' }, take: 1 },
    },
    orderBy: { openedAt: 'asc' },
  }) : []

  const enrichedCases = cases.map((c) => ({
    ...c,
    daysOpen: Math.floor((now - new Date(c.openedAt).getTime()) / 86400000),
  }))

  // ── Active leads ──────────────────────────────────────────────────────────
  const leads = (all || module === 'pipeline') ? await prisma.lead.findMany({
    where: {
      stage: { notIn: ['ClosedWon', 'ClosedLost'] },
      ...(userId ? { ownerId: userId } : {}),
    },
    include: {
      owner:   { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      country: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  }) : []

  // ── Deals (invoicing) ─────────────────────────────────────────────────────
  const deals = (all || module === 'invoicing') ? await prisma.deal.findMany({
    where: {
      ...(userId ? { agentId: userId } : {}),
    },
    include: {
      agent:    { select: { id: true, name: true } },
      account:  { select: { id: true, name: true } },
      invoices: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }) : []

  return { tasks: enrichedTasks, cases: enrichedCases, leads, deals }
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

const MODULE_FOR_ENTITY = {
  Lead:    'pipeline',
  Deal:    'invoicing',
  Invoice: 'invoicing',
  Tracker: 'onboarding',
  Case:    'cases',
  Account: 'accounts',
}

/**
 * Returns a merged, sorted activity timeline from 4 sources:
 *   ActivityLog, EngagementLog, CaseFollowUp, LeadComment
 */
export async function getActivity({ userId, module, from, to, limit = 100 } = {}) {
  const fromDate = from ? new Date(from) : null
  const toDate   = to   ? new Date(to)   : null
  const dateFilter = (field) => ({
    ...(fromDate ? { gte: fromDate } : {}),
    ...(toDate   ? { lte: toDate   } : {}),
  })

  // ── 1. ActivityLog ─────────────────────────────────────────────────────────
  const modulesToEntities = {
    pipeline:   ['Lead'],
    invoicing:  ['Deal', 'Invoice'],
    onboarding: ['Tracker'],
    cases:      ['Case'],
    accounts:   ['Account'],
  }
  const entityFilter = module && module !== 'all'
    ? { entity: { in: modulesToEntities[module] || [] } }
    : {}

  const actorFilter = userId ? { actorId: userId } : {}

  const activityLogs = await prisma.activityLog.findMany({
    where: {
      ...entityFilter,
      ...actorFilter,
      createdAt: Object.keys(dateFilter('createdAt')).length ? dateFilter('createdAt') : undefined,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // ── 2. EngagementLog ───────────────────────────────────────────────────────
  const engLogs = (!module || module === 'all' || module === 'accounts') ? await prisma.engagementLog.findMany({
    where: {
      ...(userId ? { loggedById: userId } : {}),
      loggedAt: Object.keys(dateFilter('loggedAt')).length ? dateFilter('loggedAt') : undefined,
    },
    include: {
      loggedBy: { select: { id: true, name: true } },
      account:  { select: { id: true, name: true } },
    },
    orderBy: { loggedAt: 'desc' },
    take: limit,
  }) : []

  // ── 3. CaseFollowUp ────────────────────────────────────────────────────────
  const followUps = (!module || module === 'all' || module === 'cases') ? await prisma.caseFollowUp.findMany({
    where: {
      ...(userId ? { authorId: userId } : {}),
      loggedAt: Object.keys(dateFilter('loggedAt')).length ? dateFilter('loggedAt') : undefined,
    },
    include: {
      author: { select: { id: true, name: true } },
      case:   { select: { id: true, title: true, accountId: true, account: { select: { name: true } } } },
    },
    orderBy: { loggedAt: 'desc' },
    take: limit,
  }) : []

  // ── 4. LeadComment ─────────────────────────────────────────────────────────
  const comments = (!module || module === 'all' || module === 'pipeline') ? await prisma.leadComment.findMany({
    where: {
      ...(userId ? { authorId: userId } : {}),
      createdAt: Object.keys(dateFilter('createdAt')).length ? dateFilter('createdAt') : undefined,
    },
    include: {
      author: { select: { id: true, name: true } },
      lead:   { select: { id: true, companyName: true, accountId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  }) : []

  // ── Normalise to unified shape ─────────────────────────────────────────────
  const ACTION_LABELS = {
    stage_changed:    'moved lead to',
    closed_won:       'closed lead as Won',
    created:          'created',
    phase_advanced:   'advanced to phase',
    phase_changed:    'changed phase to',
    status_changed:   'changed status to',
    opened:           'opened case',
    follow_up_added:  'added a follow-up on',
    case_edited:      'edited case',
    case_voided:      'voided case',
  }

  const normalized = [
    ...activityLogs.map((l) => ({
      id:          `al-${l.id}`,
      source:      'activity',
      module:      MODULE_FOR_ENTITY[l.entity] || 'other',
      userId:      l.actorId,
      userName:    l.actorName,
      action:      ACTION_LABELS[l.action] || l.action,
      rawAction:   l.action,
      entityType:  l.entity,
      entityId:    l.entityId,
      entityName:  l.meta?.companyName || l.meta?.title || `${l.entity} #${l.entityId}`,
      accountId:   l.accountId,
      accountName: null,
      meta:        l.meta,
      link:        entityLink(l.entity, l.entityId),
      createdAt:   l.createdAt,
    })),
    ...engLogs.map((e) => ({
      id:          `el-${e.id}`,
      source:      'engagement',
      module:      'accounts',
      userId:      e.loggedById,
      userName:    e.loggedBy?.name,
      action:      'logged engagement on',
      rawAction:   'engagement_logged',
      entityType:  'Account',
      entityId:    e.accountId,
      entityName:  e.account?.name,
      accountId:   e.accountId,
      accountName: e.account?.name,
      meta:        { channel: e.channel, objective: e.objective, notes: e.notes },
      link:        `/accounts/${e.accountId}`,
      createdAt:   e.loggedAt,
    })),
    ...followUps.map((f) => ({
      id:          `fu-${f.id}`,
      source:      'followup',
      module:      'cases',
      userId:      f.authorId,
      userName:    f.author?.name,
      action:      'added a follow-up on',
      rawAction:   'follow_up_added',
      entityType:  'Case',
      entityId:    f.caseId,
      entityName:  f.case?.title,
      accountId:   f.case?.accountId,
      accountName: f.case?.account?.name,
      meta:        { notes: f.notes, actionTaken: f.actionTaken },
      link:        `/cases/${f.caseId}`,
      createdAt:   f.loggedAt,
    })),
    ...comments.map((c) => ({
      id:          `lc-${c.id}`,
      source:      'comment',
      module:      'pipeline',
      userId:      c.authorId,
      userName:    c.author?.name,
      action:      'commented on lead',
      rawAction:   'comment_added',
      entityType:  'Lead',
      entityId:    c.leadId,
      entityName:  c.lead?.companyName,
      accountId:   c.lead?.accountId,
      accountName: null,
      meta:        { body: c.body?.slice(0, 120) },
      link:        `/pipeline/${c.leadId}`,
      createdAt:   c.createdAt,
    })),
  ]

  return normalized
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
}

function entityLink(entity, id) {
  switch (entity) {
    case 'Lead':    return `/pipeline/${id}`
    case 'Deal':    return `/invoicing/invoices`
    case 'Invoice': return `/invoicing/invoices`
    case 'Tracker': return `/onboarding/${id}`
    case 'Case':    return `/cases/${id}`
    default:        return null
  }
}
