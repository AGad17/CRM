import { prisma } from '../prisma'
import { accountStatus, accountChurnDate, sumMRR } from '../calculations'

export async function getAccounts(filters = {}) {
  const where = {}
  if (filters.country) where.country = filters.country
  if (filters.leadSource) where.leadSource = filters.leadSource

  const accounts = await prisma.account.findMany({
    where,
    include: { contracts: true },
    orderBy: { createdAt: 'desc' },
  })

  return accounts.map((a) => enrichAccount(a))
}

export async function getAccountById(id) {
  const account = await prisma.account.findUnique({
    where: { id: Number(id) },
    include: { contracts: true },
  })
  if (!account) return null
  return enrichAccount(account)
}

export async function createAccount(data) {
  return prisma.account.create({ data, include: { contracts: true } })
}

export async function updateAccount(id, data) {
  return prisma.account.update({
    where: { id: Number(id) },
    data,
    include: { contracts: true },
  })
}

function enrichAccount(account) {
  const status = accountStatus(account.contracts)
  const churnDate = accountChurnDate(account.contracts)
  const totalMRR = sumMRR(account.contracts.filter((c) => !c.cancellationDate && new Date() <= new Date(c.endDate)))
  const contractCount = account.contracts.length

  return {
    ...account,
    status,
    churnDate,
    totalMRR,
    contractCount,
  }
}
