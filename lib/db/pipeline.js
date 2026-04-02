import { prisma }  from '@/lib/prisma'
import { sumMRR }  from '../calculations'

// ─── Allowed stage transitions (enforced server-side) ────────────────────────
const VALID_TRANSITIONS = {
  Lead:       ['Qualified', 'ClosedLost'],
  Qualified:  ['ClosedWon', 'ClosedLost', 'Lead'],
  ClosedWon:  [],  // terminal — lifecycle (Expired/Churned) tracked in Operations
  ClosedLost: [],
}

const OWNER_SELECT   = { select: { id: true, name: true, email: true } }
const ACCOUNT_SELECT = { select: { id: true, name: true } }

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getLeads(filters = {}) {
  const where = {}

  // Exclude archived leads by default
  if (!filters.includeArchived) where.archived = false

  if (filters.stage)       where.stage       = filters.stage
  if (filters.channel)     where.channel     = filters.channel
  if (filters.countryCode) where.countryCode = filters.countryCode
  if (filters.ownerId)     where.ownerId     = filters.ownerId
  if (filters.q) {
    where.companyName = { contains: filters.q, mode: 'insensitive' }
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      owner:   OWNER_SELECT,
      account: {
        select: {
          id:   true,
          name: true,
          // Contracts needed to compute MRR (no Deal records exist for imported accounts)
          contracts: {
            select: { contractValue: true, startDate: true, endDate: true, cancellationDate: true },
          },
          // Latest deal as fallback if deals are ever created via close-deal flow
          deals: { select: { totalMRR: true, countryCode: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
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
  const now     = Date.now()
  const created = new Date(lead.createdAt).getTime()
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24))

  // MRR priority: deal.totalMRR → active contracts → null
  const latestDeal = lead.account?.deals?.[0] ?? null
  const dealMRR    = latestDeal?.totalMRR ? Number(latestDeal.totalMRR) : null

  const nowDate = new Date()
  const activeContracts = (lead.account?.contracts ?? []).filter(
    (c) => !c.cancellationDate && c.endDate && new Date(c.endDate) >= nowDate && c.contractValue
  )
  const contractsMRR = activeContracts.length > 0 ? sumMRR(activeContracts) : null

  // accountMRR: best available MRR figure; countryCode used for FX is the lead's own country
  const accountMRR = dealMRR ?? contractsMRR

  return {
    ...lead,
    estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
    daysOld: diffDays,
    accountMRR,   // real MRR from deal or contracts (null for open leads without a value)
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

// Derive packageInterest + numberOfBranches from lineItems for backward compat
function deriveFromLineItems(data) {
  const items = data.lineItems
  if (!Array.isArray(items) || items.length === 0) return {}
  const pkgItem = items.find(i => i.category === 'package')
  return {
    packageInterest:  pkgItem ? pkgItem.productKey : null,
    numberOfBranches: pkgItem ? Number(pkgItem.qty) || null : null,
  }
}

export async function createLead(data) {
  const derived = deriveFromLineItems(data)
  const lead = await prisma.lead.create({
    data: {
      companyName:       data.companyName,
      contactName:       data.contactName       || null,
      contactEmail:      data.contactEmail      || null,
      contactPhone:      data.contactPhone      || null,
      channel:           data.channel,
      countryCode:       data.countryCode       || null,
      estimatedValue:    data.estimatedValue    ? Number(data.estimatedValue) : null,
      valueCurrency:     data.valueCurrency     || 'USD',
      numberOfBranches:  derived.numberOfBranches ?? (data.numberOfBranches ? Number(data.numberOfBranches) : null),
      packageInterest:   derived.packageInterest  ?? (data.packageInterest   || null),
      stage:             data.stage             || 'Lead',
      notes:             data.notes             || null,
      opportunityDate:   data.opportunityDate   ? new Date(data.opportunityDate) : undefined,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      ownerId:           data.ownerId,
      opportunityType:   data.opportunityType   || null,
      accountId:         data.accountId         ? Number(data.accountId) : null,
      lineItems:         data.lineItems          || undefined,
    },
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
  })
  return enrichLead(lead)
}

export async function updateLead(id, data) {
  const derived = deriveFromLineItems(data)
  // Only allow editing of safe fields (not accountId, convertedAt, stage)
  const lead = await prisma.lead.update({
    where: { id: Number(id) },
    data: {
      companyName:        data.companyName,
      contactName:        data.contactName        ?? undefined,
      contactEmail:       data.contactEmail       ?? undefined,
      contactPhone:       data.contactPhone       ?? undefined,
      channel:            data.channel            ?? undefined,
      countryCode:        data.countryCode        ?? undefined,
      estimatedValue:     data.estimatedValue     != null ? Number(data.estimatedValue) : null,
      valueCurrency:      data.valueCurrency      ?? undefined,
      numberOfBranches:   derived.numberOfBranches ?? (data.numberOfBranches != null ? Number(data.numberOfBranches) : null),
      packageInterest:    derived.packageInterest  ?? (data.packageInterest ?? undefined),
      notes:              data.notes              ?? undefined,
      opportunityDate:    data.opportunityDate    ? new Date(data.opportunityDate) : undefined,
      expectedCloseDate:  data.expectedCloseDate  ? new Date(data.expectedCloseDate) : null,
      nextActionDate:     data.nextActionDate      ? new Date(data.nextActionDate) : data.nextActionDate === '' ? null : undefined,
      ownerId:            data.ownerId            ?? undefined,
      lineItems:          data.lineItems !== undefined ? (data.lineItems || null) : undefined,
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
  if (newStage === 'ClosedLost') {
    updateData.lostReason         = extra.lostReason         || null
    updateData.lostReasonCategory = extra.lostReasonCategory || null
  }

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

export async function archiveLead(id, reason) {
  const lead = await prisma.lead.update({
    where: { id: Number(id) },
    data: { archived: true, archiveReason: reason || null },
    include: { owner: OWNER_SELECT, account: ACCOUNT_SELECT },
  })
  return enrichLead(lead)
}

export async function deleteLead(id) {
  await prisma.lead.delete({ where: { id: Number(id) } })
}

// ─── Lead Activities (touchpoints) ───────────────────────────────────────────

const ACTOR_SELECT = { select: { id: true, name: true, email: true } }

export async function getLeadActivities(leadId) {
  return prisma.leadActivity.findMany({
    where:   { leadId: Number(leadId) },
    include: { actor: ACTOR_SELECT },
    orderBy: { loggedAt: 'desc' },
  })
}

export async function createLeadActivity(leadId, data) {
  return prisma.leadActivity.create({
    data: {
      leadId:  Number(leadId),
      type:    data.type,
      notes:   data.notes   || null,
      outcome: data.outcome || null,
      loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
      actorId: data.actorId,
    },
    include: { actor: ACTOR_SELECT },
  })
}

// ─── Duplicate check ─────────────────────────────────────────────────────────

export async function findDuplicateLeads(companyName) {
  if (!companyName?.trim()) return []
  return prisma.lead.findMany({
    where: {
      companyName: { contains: companyName.trim(), mode: 'insensitive' },
      archived:    false,
    },
    select: { id: true, companyName: true, stage: true, owner: OWNER_SELECT },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })
}

// ─── One-time migration from existing Accounts ───────────────────────────────
// Idempotent: skips any Account that already has a linked Lead.
// All accounts that ever had contracts → ClosedWon (lifecycle tracked in Operations)

export async function migrateAccountsToLeads(adminUserId) {
  const accounts = await prisma.account.findMany({
    include: {
      contracts: { select: { cancellationDate: true, endDate: true } },
      country:   { select: { name: true } },
      leads:     { select: { id: true }, where: { opportunityType: null } },
    },
  })

  let created = 0
  let skipped = 0

  for (const account of accounts) {
    if (account.leads.length > 0) { skipped++; continue }

    const stage  = 'ClosedWon'  // all existing accounts were won deals; lifecycle in Operations

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
