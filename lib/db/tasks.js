import { prisma } from '@/lib/prisma'

const USER_SELECT   = { select: { id: true, name: true, email: true } }
const ACCOUNT_SELECT = { select: { id: true, name: true } }

function includeAll() {
  return {
    assignedTo: USER_SELECT,
    createdBy:  USER_SELECT,
    account:    ACCOUNT_SELECT,
    lead:       { select: { id: true, companyName: true } },
    case:       { select: { id: true, title: true } },
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getTasks(filters = {}) {
  const where = {}

  if (filters.assignedToId)  where.assignedToId = filters.assignedToId
  if (filters.createdById)   where.createdById  = filters.createdById
  if (filters.status)        where.status       = filters.status
  if (filters.accountId)     where.accountId    = Number(filters.accountId)
  if (filters.leadId)        where.leadId       = Number(filters.leadId)
  if (filters.caseId)        where.caseId       = Number(filters.caseId)

  // Date range
  if (filters.from || filters.to) {
    where.dueDate = {}
    if (filters.from) where.dueDate.gte = new Date(filters.from)
    if (filters.to)   where.dueDate.lte = new Date(filters.to)
  }

  // Unless fetching all statuses explicitly, default to Open+Done (exclude Cancelled)
  if (!filters.status && !filters.includeAll) {
    where.status = { in: ['Open', 'Done'] }
  }

  return prisma.task.findMany({
    where,
    include:  includeAll(),
    orderBy:  { dueDate: 'asc' },
  })
}

export async function getTask(id) {
  return prisma.task.findUnique({
    where:   { id: Number(id) },
    include: includeAll(),
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTask(data) {
  return prisma.task.create({
    data: {
      title:        data.title.trim(),
      type:         data.type,
      assignedToId: data.assignedToId,
      createdById:  data.createdById,
      dueDate:      new Date(data.dueDate),
      notes:        data.notes   || null,
      accountId:    data.accountId ? Number(data.accountId) : null,
      leadId:       data.leadId   ? Number(data.leadId)     : null,
      caseId:       data.caseId   ? Number(data.caseId)     : null,
    },
    include: includeAll(),
  })
}

export async function updateTask(id, data) {
  const update = {}
  if (data.title        !== undefined) update.title        = data.title.trim()
  if (data.type         !== undefined) update.type         = data.type
  if (data.assignedToId !== undefined) update.assignedToId = data.assignedToId
  if (data.dueDate      !== undefined) update.dueDate      = new Date(data.dueDate)
  if (data.notes        !== undefined) update.notes        = data.notes || null
  if (data.accountId    !== undefined) update.accountId    = data.accountId ? Number(data.accountId) : null
  if (data.leadId       !== undefined) update.leadId       = data.leadId   ? Number(data.leadId)     : null
  if (data.caseId       !== undefined) update.caseId       = data.caseId   ? Number(data.caseId)     : null

  if (data.status === 'Done') {
    update.status      = 'Done'
    update.completedAt = new Date()
    update.completedNotes = data.completedNotes || null
  } else if (data.status === 'Cancelled') {
    update.status = 'Cancelled'
  } else if (data.status === 'Open') {
    update.status      = 'Open'
    update.completedAt = null
    update.completedNotes = null
  }

  return prisma.task.update({
    where:   { id: Number(id) },
    data:    update,
    include: includeAll(),
  })
}

export async function deleteTask(id) {
  await prisma.task.delete({ where: { id: Number(id) } })
}
