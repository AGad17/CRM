import { prisma } from '../prisma'
import { enrichContract } from '../calculations'

export async function getContracts(filters = {}) {
  const where = {}
  if (filters.accountId) where.accountId = Number(filters.accountId)
  if (filters.type) where.type = filters.type
  if (filters.year) {
    const y = Number(filters.year)
    where.startDate = {
      gte: new Date(`${y}-01-01`),
      lt: new Date(`${y + 1}-01-01`),
    }
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: { account: { select: { id: true, name: true, country: true } } },
    orderBy: { startDate: 'desc' },
  })

  return contracts.map(enrichContract)
}

export async function getContractById(id) {
  const contract = await prisma.contract.findUnique({
    where: { id: Number(id) },
    include: { account: { select: { id: true, name: true, country: true } } },
  })
  if (!contract) return null
  return enrichContract(contract)
}

export async function createContract(data) {
  const contract = await prisma.contract.create({
    data: {
      accountId: Number(data.accountId),
      contractValue: data.contractValue,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      type: data.type,
    },
    include: { account: { select: { id: true, name: true, country: true } } },
  })
  return enrichContract(contract)
}

export async function updateContract(id, data) {
  const payload = {}
  if (data.contractValue !== undefined) payload.contractValue = data.contractValue
  if (data.startDate) payload.startDate = new Date(data.startDate)
  if (data.endDate) payload.endDate = new Date(data.endDate)
  if (data.type) payload.type = data.type

  const contract = await prisma.contract.update({
    where: { id: Number(id) },
    data: payload,
    include: { account: { select: { id: true, name: true, country: true } } },
  })
  return enrichContract(contract)
}

export async function cancelContract(id, cancellationDate) {
  const contract = await prisma.contract.update({
    where: { id: Number(id) },
    data: { cancellationDate: new Date(cancellationDate) },
    include: { account: { select: { id: true, name: true, country: true } } },
  })
  return enrichContract(contract)
}
