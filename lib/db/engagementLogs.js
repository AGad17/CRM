import { prisma } from '../prisma'

const INCLUDE_FULL = {
  account:  { select: { id: true, name: true } },
  loggedBy: { select: { id: true, name: true, email: true } },
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getEngagementLogs(filters = {}) {
  const where = {}
  if (filters.accountId)  where.accountId  = Number(filters.accountId)
  if (filters.channel)    where.channel    = filters.channel
  if (filters.objective)  where.objective  = filters.objective
  if (filters.loggedById) where.loggedById = filters.loggedById
  if (filters.from || filters.to) {
    where.loggedAt = {}
    if (filters.from) where.loggedAt.gte = new Date(filters.from)
    if (filters.to)   where.loggedAt.lte = new Date(filters.to)
  }

  return prisma.engagementLog.findMany({
    where,
    include: INCLUDE_FULL,
    orderBy: { loggedAt: 'desc' },
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createEngagementLog(data, userId) {
  return prisma.engagementLog.create({
    data: {
      accountId:  Number(data.accountId),
      loggedById: userId,
      channel:    data.channel,
      objective:  data.objective,
      notes:      data.notes || null,
      loggedAt:   new Date(data.loggedAt),
      startTime:  data.startTime ? new Date(data.startTime) : null,
      endTime:    data.endTime   ? new Date(data.endTime)   : null,
    },
    include: INCLUDE_FULL,
  })
}

export async function updateEngagementLog(id, data) {
  return prisma.engagementLog.update({
    where: { id: Number(id) },
    data: {
      channel:   data.channel,
      objective: data.objective,
      notes:     data.notes ?? null,
      loggedAt:  new Date(data.loggedAt),
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime:   data.endTime   ? new Date(data.endTime)   : null,
    },
    include: INCLUDE_FULL,
  })
}

export async function deleteEngagementLog(id) {
  return prisma.engagementLog.delete({ where: { id: Number(id) } })
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

/**
 * Returns { accountId → { total, last30d, lastLoggedAt } } for a set of accountIds.
 * Used to enrich Account Health and CS Performance queries.
 */
export async function getEngagementStatsByAccount(accountIds) {
  if (!accountIds?.length) return {}

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const logs = await prisma.engagementLog.findMany({
    where: { accountId: { in: accountIds } },
    select: { accountId: true, loggedAt: true },
    orderBy: { loggedAt: 'desc' },
  })

  const stats = {}
  for (const log of logs) {
    const aid = log.account_id ?? log.accountId
    if (!stats[aid]) stats[aid] = { total: 0, last30d: 0, lastLoggedAt: null }
    stats[aid].total++
    if (!stats[aid].lastLoggedAt) stats[aid].lastLoggedAt = log.loggedAt
    if (new Date(log.loggedAt) >= thirtyDaysAgo) stats[aid].last30d++
  }
  return stats
}

/**
 * Returns engagement stats grouped by logged-by userId.
 * Used in CS Performance to show per-account-manager engagement activity.
 */
export async function getEngagementStatsByUser(userIds) {
  if (!userIds?.length) return {}

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const logs = await prisma.engagementLog.findMany({
    where: { loggedById: { in: userIds } },
    select: { loggedById: true, loggedAt: true },
  })

  const stats = {}
  for (const log of logs) {
    const uid = log.loggedById
    if (!stats[uid]) stats[uid] = { total: 0, last30d: 0 }
    stats[uid].total++
    if (new Date(log.loggedAt) >= thirtyDaysAgo) stats[uid].last30d++
  }
  return stats
}
