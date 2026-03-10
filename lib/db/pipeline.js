import { prisma } from '@/lib/prisma'
import { accountStatus } from '@/lib/calculations'

// ─── Allowed stage transitions (enforced server-side) ────────────────────────
const VALID_TRANSITIONS = {
  Lead:      ['Qualified', 'ClosedLost'],
  Qualified: ['ClosedWon', 'ClosedLost', 'Lead'],
  ClosedWon: ['Churned'],
  ClosedLost: [],
  Churned:   [],
}

const OWNER_SELECT   = { select: { id: true, name: true, email: true } }
const ACCOUNT_SELECT = { select: { id: true, name: true } }

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getLeads(filters = {}) {
  const where = {}

  if (filters.stage)       where.stage       = filters.stage
  if (filters.channel)     where.channel     = filters.channel
  if (filters.countryCode) where.countryCode = filters.countryCode
  if (filters.ownerId)     where.ownerId     = filters.ownerId

  const leads = await prisma.lead.findMany({
    where,
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
    orderBy: { createdAt: 'desc' },
  })

  return leads.map(enrichLead)
}

export async function getLead(id) {
  const lead = await prisma.lead.findUnique({
    where: { id: Number(id) },
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
  })
  return lead ? enrichLead(lead) : null
}

function enrichLead(lead) {
  const now = Date.now()
  const created = new Date(lead.createdAt).getTime()
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24))
  return {
    ...lead,
    estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
    daysOld: diffDays,
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createLead(data) {
  const lead = await prisma.lead.create({
    data: {
      companyName:       data.companyName,
      contactName:       data.contactName       || null,
      contactEmail:      data.contactEmail      || null,
      contactPhone:      data.contactPhone      || null,
      channel:           data.channel,
      countryCode:       data.countryCode       || null,
      estimatedValue:    data.estimatedValue    ? Number(data.estimatedValue) : null,
      packageInterest:   data.packageInterest   || null,
      stage:             data.stage             || 'Lead',
      notes:             data.notes             || null,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      ownerId:           data.ownerId,
    },
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
  })
  return enrichLead(lead)
}

export async function updateLead(id, data) {
  // Only allow editing of safe fields (not accountId, convertedAt, stage)
  const lead = await prisma.lead.update({
    where: { id: Number(id) },
    data: {
      companyName:       data.companyName,
      contactName:       data.contactName       ?? undefined,
      contactEmail:      data.contactEmail      ?? undefined,
      contactPhone:      data.contactPhone      ?? undefined,
      channel:           data.channel           ?? undefined,
      countryCode:       data.countryCode       ?? undefined,
      estimatedValue:    data.estimatedValue    != null ? Number(data.estimatedValue) : null,
      packageInterest:   data.packageInterest   ?? undefined,
      notes:             data.notes             ?? undefined,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      ownerId:           data.ownerId           ?? undefined,
    },
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
  })
  return enrichLead(lead)
}

export async function updateLeadStage(id, newStage, extra = {}) {
  const existing = await prisma.lead.findUnique({ where: { id: Number(id) } })
  if (!existing) throw new Error('Lead not found')

  const allowed = VALID_TRANSITIONS[existing.stage] || []
  if (!allowed.includes(newStage)) {
    throw new Error(`Invalid transition: ${existing.stage} → ${newStage}`)
  }

  const updateData = { stage: newStage }

  if (newStage === 'ClosedWon')  updateData.convertedAt = new Date()
  if (newStage === 'ClosedLost') updateData.lostReason = extra.lostReason || null
  if (newStage === 'Churned')    updateData.lostReason = null // clear any prior lost reason

  const lead = await prisma.lead.update({
    where: { id: Number(id) },
    data: updateData,
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
  })
  return enrichLead(lead)
}

// ─── Link lead to a CRM account (called after account creation on Won) ────────
export async function linkLeadToAccount(leadId, accountId) {
  const lead = await prisma.lead.update({
    where: { id: Number(leadId) },
    data:  { accountId: Number(accountId) },
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
  })
  return enrichLead(lead)
}

export async function deleteLead(id) {
  await prisma.lead.delete({ where: { id: Number(id) } })
}

// ─── One-time migration from existing Accounts ───────────────────────────────
// Idempotent: skips any Account that already has a linked Lead.
// Active accounts → ClosedWon  |  Churned accounts → Churned
// (Churned ≠ ClosedLost: they were paying customers who later cancelled)

export async function migrateAccountsToLeads(adminUserId) {
  const accounts = await prisma.account.findMany({
    include: {
      contracts: { select: { cancellationDate: true, endDate: true } },
      country:   { select: { name: true } },
      lead:      { select: { id: true } },
    },
  })

  let created = 0
  let skipped = 0

  for (const account of accounts) {
    if (account.lead) { skipped++; continue }

    const status = accountStatus(account.contracts)
    const stage  = status === 'Active' ? 'ClosedWon' : 'Churned'

    await prisma.lead.create({
      data: {
        companyName:  account.name,
        channel:      account.leadSource,
        countryCode:  account.country?.name || null,
        stage,
        ownerId:      adminUserId,
        accountId:    account.id,
        convertedAt:  account.createdAt,
        createdAt:    account.createdAt,
        updatedAt:    account.createdAt,
      },
    })
    created++
  }

  return { created, skipped }
}
