import { prisma } from '@/lib/prisma'

// ─── Shared include ───────────────────────────────────────────────────────────

const INCLUDE_FULL = {
  account:    { select: { id: true, name: true } },
  openedBy:   { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  followUps: {
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { loggedAt: 'asc' },
  },
  outage: { select: { id: true, title: true, outageStatus: true } },
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCases(filters = {}) {
  const { status, objective, accountId, assignedToIds, openedByIds, from, to } = filters

  const where = {
    objective: { not: 'GlobalOutage' }, // outages queried separately
  }

  if (status)    where.status    = status
  if (objective) where.objective = objective
  if (accountId) where.accountId = Number(accountId)
  if (assignedToIds?.length) where.assignedToId = { in: assignedToIds }
  if (openedByIds?.length)   where.openedById   = { in: openedByIds }
  if (from || to) {
    where.openedAt = {}
    if (from) where.openedAt.gte = new Date(from)
    if (to)   where.openedAt.lte = new Date(to)
  }

  return prisma.engagementCase.findMany({
    where,
    include: INCLUDE_FULL,
    orderBy: { openedAt: 'desc' },
  })
}

export async function getCase(id) {
  return prisma.engagementCase.findUnique({
    where: { id: Number(id) },
    include: INCLUDE_FULL,
  })
}

export async function getCasesByAccount(accountId) {
  return prisma.engagementCase.findMany({
    where: {
      accountId:  Number(accountId),
      objective:  { not: 'GlobalOutage' },
    },
    include: INCLUDE_FULL,
    orderBy: { openedAt: 'desc' },
  })
}

export async function getActiveOutages() {
  return prisma.engagementCase.findMany({
    where: { objective: 'GlobalOutage', outageStatus: 'Active' },
    include: INCLUDE_FULL,
    orderBy: { openedAt: 'desc' },
  })
}

export async function getAllOutages() {
  return prisma.engagementCase.findMany({
    where: { objective: 'GlobalOutage' },
    include: INCLUDE_FULL,
    orderBy: { openedAt: 'desc' },
  })
}

// ─── Case Mutations ───────────────────────────────────────────────────────────

export async function createCase(data, userId) {
  const { accountId, title, channel, objective, description, assignedToId, openedAt, outageId } = data
  return prisma.engagementCase.create({
    data: {
      accountId:    accountId ? Number(accountId) : null,
      openedById:   userId,
      title,
      channel,
      objective,
      description:  description || null,
      assignedToId: assignedToId || null,
      openedAt:     openedAt ? new Date(openedAt) : new Date(),
      status:       'Open',
      outageId:     outageId ? Number(outageId) : null,
    },
    include: INCLUDE_FULL,
  })
}

export async function getOutageWithCases(id) {
  return prisma.engagementCase.findUnique({
    where: { id: Number(id) },
    include: {
      ...INCLUDE_FULL,
      linkedCases: {
        include: {
          account:  { select: { id: true, name: true } },
          openedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { openedAt: 'asc' },
      },
    },
  })
}

export async function updateCase(id, data) {
  const { accountId, title, channel, objective, description, assignedToId, outageId } = data
  return prisma.engagementCase.update({
    where: { id: Number(id) },
    data: {
      ...(accountId    !== undefined && { accountId: accountId ? Number(accountId) : null }),
      ...(title        !== undefined && { title }),
      ...(channel      !== undefined && { channel }),
      ...(objective    !== undefined && { objective }),
      ...(description  !== undefined && { description }),
      ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
      ...(outageId     !== undefined && { outageId: outageId ? Number(outageId) : null }),
    },
    include: INCLUDE_FULL,
  })
}

export async function voidCase(id, reason) {
  return prisma.engagementCase.update({
    where: { id: Number(id) },
    data: { status: 'Voided', voidReason: reason },
    include: INCLUDE_FULL,
  })
}

export async function updateCaseStatus(id, status) {
  const resolved = status === 'Resolved' || status === 'ClosedUnresolved'
  return prisma.engagementCase.update({
    where: { id: Number(id) },
    data: {
      status,
      resolvedAt: resolved ? new Date() : null,
    },
    include: INCLUDE_FULL,
  })
}

export async function deleteCase(id) {
  return prisma.engagementCase.delete({ where: { id: Number(id) } })
}

// ─── Follow-up Mutations ──────────────────────────────────────────────────────

export async function addFollowUp(caseId, data, userId) {
  const { channel, actionTaken, notes, loggedAt } = data
  return prisma.caseFollowUp.create({
    data: {
      caseId:      Number(caseId),
      authorId:    userId,
      channel:     channel || null,
      actionTaken: actionTaken || null,
      notes:       notes || null,
      loggedAt:    loggedAt ? new Date(loggedAt) : new Date(),
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  })
}

export async function deleteFollowUp(fid) {
  return prisma.caseFollowUp.delete({ where: { id: Number(fid) } })
}

// ─── Outage Mutations ─────────────────────────────────────────────────────────

export async function createOutage(data, userId) {
  const { title, description } = data
  return prisma.engagementCase.create({
    data: {
      openedById:   userId,
      title,
      channel:      'Other',   // channel not applicable for outages
      objective:    'GlobalOutage',
      description:  description || null,
      status:       'Open',
      outageStatus: 'Active',
      accountId:    null,
    },
    include: INCLUDE_FULL,
  })
}

export async function resolveOutage(id) {
  return prisma.engagementCase.update({
    where: { id: Number(id) },
    data: {
      outageStatus: 'Resolved',
      status:       'Resolved',
      resolvedAt:   new Date(),
    },
    include: INCLUDE_FULL,
  })
}

// ─── Analytics / Report ───────────────────────────────────────────────────────

export async function getCaseStats(filters = {}) {
  const { status, objective, accountId, assignedToId, from, to } = filters

  const where = { objective: { not: 'GlobalOutage' } }
  if (status)       where.status       = status
  if (objective)    where.objective    = objective
  if (accountId)    where.accountId    = Number(accountId)
  if (assignedToId) where.assignedToId = assignedToId
  if (from || to) {
    where.openedAt = {}
    if (from) where.openedAt.gte = new Date(from)
    if (to)   where.openedAt.lte = new Date(to)
  }

  const [total, openCount, resolvedThisMonth, escalatedCount, resolvedCases] = await Promise.all([
    prisma.engagementCase.count({ where }),
    prisma.engagementCase.count({ where: { ...where, status: 'Open' } }),
    prisma.engagementCase.count({
      where: {
        ...where,
        status:    'Resolved',
        resolvedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.engagementCase.count({ where: { ...where, status: 'Escalated' } }),
    prisma.engagementCase.findMany({
      where: {
        ...where,
        status:    { in: ['Resolved', 'ClosedUnresolved'] },
        resolvedAt: { not: null },
      },
      select: { openedAt: true, resolvedAt: true },
    }),
  ])

  const closedCount = total - openCount - escalatedCount
  const resolutionRate = total > 0 ? Math.round((closedCount / total) * 100) : 0

  let avgTTRHours = null
  if (resolvedCases.length > 0) {
    const totalMs = resolvedCases.reduce((sum, c) => sum + (c.resolvedAt - c.openedAt), 0)
    avgTTRHours = totalMs / resolvedCases.length / (1000 * 60 * 60)
  }

  return { total, openCount, resolvedThisMonth, escalatedCount, closedCount, resolutionRate, avgTTRHours }
}

export async function getCaseStatsByAccount(accountIds) {
  const rows = await prisma.engagementCase.groupBy({
    by:     ['accountId'],
    where:  { accountId: { in: accountIds }, objective: { not: 'GlobalOutage' } },
    _count: { id: true },
  })
  const openRows = await prisma.engagementCase.groupBy({
    by:     ['accountId'],
    where:  { accountId: { in: accountIds }, status: 'Open', objective: { not: 'GlobalOutage' } },
    _count: { id: true },
  })
  const map = {}
  for (const r of rows) {
    map[r.accountId] = { total: r._count.id, open: 0 }
  }
  for (const r of openRows) {
    if (map[r.accountId]) map[r.accountId].open = r._count.id
    else map[r.accountId] = { total: 0, open: r._count.id }
  }
  return map
}
