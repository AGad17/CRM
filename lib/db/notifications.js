import { prisma } from '@/lib/prisma'

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createNotification({ userId, type, title, body, link }) {
  return prisma.notification.create({
    data: { userId, type, title, body: body ?? null, link: link ?? null },
  })
}

/**
 * Bulk-insert one notification per recipient (used for outage broadcasts).
 * @param {string[]} userIds
 * @param {{ type, title, body?, link? }} payload
 */
export async function createNotifications(userIds, { type, title, body, link }) {
  if (!userIds.length) return
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId, type, title, body: body ?? null, link: link ?? null,
    })),
  })
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getNotifications(userId, { unreadOnly = false, limit = 20 } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } })
}

// ─── Mark Read ────────────────────────────────────────────────────────────────

export async function markRead(userId, ids) {
  return prisma.notification.updateMany({
    where: { userId, id: { in: ids.map(Number) } },
    data: { isRead: true },
  })
}

export async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all active users' IDs — used for outage broadcasts. */
export async function getAllActiveUserIds() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

/**
 * Deduplication guard for cron notifications.
 * Returns true if a notification of the same type+link was already created in the last 25 hours.
 */
export async function notificationExists(userId, type, link) {
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000)
  const existing = await prisma.notification.findFirst({
    where: { userId, type, link, createdAt: { gte: cutoff } },
  })
  return !!existing
}
