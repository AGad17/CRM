import { prisma } from '../prisma'
import { accountStatus, accountChurnDate, sumMRR, contractPeriod, mrr, enrichContract } from '../calculations'

const COUNTRY_SELECT = { select: { id: true, code: true, name: true, currency: true } }

export async function getAccounts(filters = {}) {
  const where = {}
  if (filters.leadSource) where.leadSource = filters.leadSource
  if (filters.country) where.country = { code: filters.country }

  const accounts = await prisma.account.findMany({
    where,
    include: {
      contracts: true,
      country: COUNTRY_SELECT,
      onboarding: {
        select: {
          id: true, phase: true, startDate: true,
          tasks:          { select: { id: true, phase: true, completed: true } },
          accountManager: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return accounts.map(enrichAccount)
}

export async function getAccountById(id) {
  const account = await prisma.account.findUnique({
    where: { id: Number(id) },
    include: {
      contracts: true,
      country: COUNTRY_SELECT,
      leads: {
        select: {
          id: true,
          companyName: true,
          channel: true,
          estimatedValue: true,
          convertedAt: true,
          createdAt: true,
          opportunityType: true,
        },
        where:   { opportunityType: null },   // original "New" lead only
        orderBy: { createdAt: 'asc' },
        take:    1,
      },
      deals: {
        select: {
          id: true,
          accountName: true,
          package: true,
          contractValue: true,
          contractValueInclVAT: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      onboarding: {
        select: {
          id: true,
          phase: true,
          startDate: true,
          tasks: { select: { id: true, phase: true, completed: true } },
        },
      },
    },
  })
  if (!account) return null
  return enrichAccount(account)
}

export async function createAccount(data) {
  let countryId = data.countryId
  if (!countryId && data.country) {
    const c = await prisma.country.findUnique({ where: { code: data.country } })
    if (!c) throw new Error(`Country not found: ${data.country}`)
    countryId = c.id
  }

  const account = await prisma.account.create({
    data: {
      name: data.name,
      leadSource: data.leadSource,
      countryId,
      brands: data.brands || 1,
      numberOfBranches: data.numberOfBranches || 1,
      numberOfCostCentres: data.numberOfCostCentres || null,
    },
    include: { contracts: true, country: COUNTRY_SELECT },
  })
  return enrichAccount(account)
}

export async function updateAccount(id, data) {
  const payload = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.leadSource) payload.leadSource = data.leadSource
  if (data.brands !== undefined) payload.brands = Number(data.brands)
  if (data.numberOfBranches !== undefined) payload.numberOfBranches = Number(data.numberOfBranches)
  if (data.numberOfCostCentres !== undefined) payload.numberOfCostCentres = data.numberOfCostCentres ? Number(data.numberOfCostCentres) : null
  if (data.country) {
    const c = await prisma.country.findUnique({ where: { code: data.country } })
    if (c) payload.countryId = c.id
  }
  if (data.countryId) payload.countryId = Number(data.countryId)

  const account = await prisma.account.update({
    where: { id: Number(id) },
    data: payload,
    include: { contracts: true, country: COUNTRY_SELECT },
  })
  return enrichAccount(account)
}

export async function churnAccount(id) {
  const today = new Date()

  // Cancel all non-cancelled contracts for this account
  const { count } = await prisma.contract.updateMany({
    where: { accountId: id, cancellationDate: null },
    data: { cancellationDate: today },
  })

  const account = await prisma.account.findUnique({
    where: { id },
    include: { contracts: true, country: COUNTRY_SELECT },
  })

  return { ...enrichAccount(account), cancelledContracts: count }
}

function enrichAccount(account) {
  const enrichedContracts = account.contracts.map(enrichContract)
  const status = accountStatus(enrichedContracts)
  const churnDate = accountChurnDate(enrichedContracts)
  const totalMRR = sumMRR(enrichedContracts.filter((c) => !c.cancellationDate && new Date() <= new Date(c.endDate)))
  const contractCount = enrichedContracts.length

  return {
    ...account,
    contracts: enrichedContracts,
    countryCode: account.country?.code,
    countryName: account.country?.name,
    currency: account.country?.currency,
    status,
    churnDate,
    totalMRR,
    contractCount,
    lead: account.leads?.[0] ?? null,
    deals: account.deals ?? [],
    accountManager: account.onboarding?.accountManager ?? null,
    onboarding: account.onboarding ? (() => {
      const ob = account.onboarding
      const total = ob.tasks.length
      const done  = ob.tasks.filter(t => t.completed).length
      const phaseTasks = ob.tasks.filter(t => t.phase === ob.phase)
      const phaseDone  = phaseTasks.filter(t => t.completed).length
      return {
        id: ob.id,
        phase: ob.phase,
        startDate: ob.startDate,
        totalTasks: total,
        completedTasks: done,
        currentPhaseTasks: phaseTasks.length,
        currentPhaseCompleted: phaseDone,
      }
    })() : null,
  }
}
