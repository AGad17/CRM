import { prisma } from '@/lib/prisma'

/**
 * Write an activity log entry.
 * @param {object} opts
 * @param {string}  opts.entity     - 'Lead' | 'Deal' | 'Tracker' | 'Invoice'
 * @param {number}  opts.entityId   - primary key of the entity
 * @param {number}  [opts.accountId] - denormalized for account timeline queries
 * @param {string}  opts.action     - short action code, e.g. 'stage_changed'
 * @param {string}  [opts.actorId]   - User.id (from session)
 * @param {string}  [opts.actorName] - User display name
 * @param {object}  [opts.meta]      - arbitrary JSON payload { from, to, ... }
 */
export async function logActivity({ entity, entityId, accountId, action, actorId, actorName, meta } = {}) {
  try {
    await prisma.activityLog.create({
      data: {
        entity,
        entityId:  Number(entityId),
        accountId: accountId ? Number(accountId) : null,
        action,
        actorId:   actorId   || null,
        actorName: actorName || null,
        meta:      meta      || undefined,
      },
    })
  } catch {
    // Non-critical — never let logging break the main operation
  }
}

/**
 * Fetch activity log entries for a given entity.
 */
export async function getActivityLog(entity, entityId, limit = 50) {
  return prisma.activityLog.findMany({
    where:   { entity, entityId: Number(entityId) },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
}

/**
 * Fetch all activity log entries for an account (across all entity types).
 */
export async function getAccountActivityLog(accountId, limit = 100) {
  return prisma.activityLog.findMany({
    where:   { accountId: Number(accountId) },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
}
