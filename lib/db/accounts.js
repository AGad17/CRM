import { prisma } from '../prisma'
import { accountStatus, accountChurnDate, sumMRR, contractPeriod, mrr } from '../calculations'

const COUNTRY_SELECT = { select: { id: true, code: true, name: true, currency: true } }

export async function getAccounts(filters = {}) {
  const where = {}
  if (filters.leadSource) where.leadSource = filters.leadSource
  if (filters.country) where.country = { code: filters.country }

  const accounts = await prisma.account.findMany({
    where,
    include: { contracts: true, country: COUNTRY_SELECT },
    orderBy: { createdAt: 'desc' },
  })

  return accounts.map(enrichAccount)
}

export async function getAccountById(id) {
  const account = await prisma.account.findUnique({
    where: { id: Number(id) },
    include: { contracts: true, country: COUNTRY_SELECT },
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
  const status = accountStatus(account.contracts)
  const churnDate = accountChurnDate(account.contracts)
  const totalMRR = sumMRR(account.contracts.filter((c) => !c.cancellationDate && new Date() <= new Date(c.endDate)))
  const contractCount = account.contracts.length

  return {
    ...account,
    countryCode: account.country?.code,
    countryName: account.country?.name,
    currency: account.country?.currency,
    status,
    churnDate,
    totalMRR,
    contractCount,
  }
}
