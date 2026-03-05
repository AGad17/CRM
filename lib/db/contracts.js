import { prisma } from '../prisma'
import { enrichContract } from '../calculations'
import { getUSDRate } from '../exchange-rate'

const CONTRACT_INCLUDE = {
  account: {
    select: {
      id: true,
      name: true,
      country: { select: { id: true, code: true, name: true, currency: true } },
    },
  },
  items: {
    include: { product: { select: { id: true, name: true, category: true } } },
    orderBy: { id: 'asc' },
  },
}

function calcLineTotal(unitPrice, quantity, paymentPlan) {
  const base = Number(unitPrice) * Number(quantity)
  if (paymentPlan === 'Quarterly') return base * 1.06
  return base // Yearly or OneTime
}

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
    include: CONTRACT_INCLUDE,
    orderBy: { startDate: 'desc' },
  })

  return contracts.map(enrichContract)
}

export async function getContractById(id) {
  const contract = await prisma.contract.findUnique({
    where: { id: Number(id) },
    include: CONTRACT_INCLUDE,
  })
  if (!contract) return null
  return enrichContract(contract)
}

export async function createContract(data) {
  // Fetch account to get country currency for FX rate
  const account = await prisma.account.findUnique({
    where: { id: Number(data.accountId) },
    include: { country: { select: { currency: true } } },
  })
  const currency = account?.country?.currency

  // Build items with computed lineTotals
  const items = (data.items || []).map((item) => ({
    productId: item.productId ? Number(item.productId) : null,
    description: item.description,
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice),
    paymentPlan: item.paymentPlan,
    lineTotal: calcLineTotal(item.unitPrice, Number(item.quantity) || 1, item.paymentPlan),
  }))

  const contractValue =
    items.length > 0
      ? items.reduce((sum, i) => sum + i.lineTotal, 0)
      : Number(data.contractValue || 0)

  // Fetch historical USD rate at contract start date
  const usdRate = currency ? await getUSDRate(currency, data.startDate) : null

  const contract = await prisma.contract.create({
    data: {
      accountId: Number(data.accountId),
      contractValue,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      type: data.type,
      cancellationDate: data.cancellationDate ? new Date(data.cancellationDate) : undefined,
      usdRate: usdRate ?? undefined,
      items: items.length > 0 ? { create: items } : undefined,
    },
    include: CONTRACT_INCLUDE,
  })
  return enrichContract(contract)
}

export async function updateContract(id, data) {
  const payload = {}
  if (data.startDate) payload.startDate = new Date(data.startDate)
  if (data.endDate) payload.endDate = new Date(data.endDate)
  if (data.type) payload.type = data.type

  if (data.items && data.items.length > 0) {
    // Replace all items and recompute contract value from new items
    await prisma.contractItem.deleteMany({ where: { contractId: Number(id) } })
    const items = data.items.map((item) => ({
      productId: item.productId ? Number(item.productId) : null,
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice),
      paymentPlan: item.paymentPlan,
      lineTotal: calcLineTotal(item.unitPrice, Number(item.quantity) || 1, item.paymentPlan),
    }))
    payload.contractValue = items.reduce((sum, i) => sum + i.lineTotal, 0)
    payload.items = { create: items }
  } else if (data.contractValue !== undefined) {
    payload.contractValue = data.contractValue
  }

  const contract = await prisma.contract.update({
    where: { id: Number(id) },
    data: payload,
    include: CONTRACT_INCLUDE,
  })
  return enrichContract(contract)
}

export async function cancelContract(id, cancellationDate) {
  const contract = await prisma.contract.update({
    where: { id: Number(id) },
    data: { cancellationDate: new Date(cancellationDate) },
    include: CONTRACT_INCLUDE,
  })
  return enrichContract(contract)
}

// ─── Contract Item helpers ─────────────────────────────────────────────────────

export async function addContractItem(contractId, data) {
  const lineTotal = calcLineTotal(data.unitPrice, Number(data.quantity) || 1, data.paymentPlan)
  await prisma.contractItem.create({
    data: {
      contractId: Number(contractId),
      productId: data.productId ? Number(data.productId) : null,
      description: data.description,
      quantity: Number(data.quantity) || 1,
      unitPrice: Number(data.unitPrice),
      paymentPlan: data.paymentPlan,
      lineTotal,
    },
  })
  return recalcContractValue(contractId)
}

export async function updateContractItem(contractId, itemId, data) {
  const existing = await prisma.contractItem.findUnique({ where: { id: Number(itemId) } })
  const unitPrice = data.unitPrice !== undefined ? Number(data.unitPrice) : Number(existing.unitPrice)
  const quantity = data.quantity !== undefined ? Number(data.quantity) : existing.quantity
  const paymentPlan = data.paymentPlan || existing.paymentPlan
  const lineTotal = calcLineTotal(unitPrice, quantity, paymentPlan)

  await prisma.contractItem.update({
    where: { id: Number(itemId) },
    data: {
      description: data.description !== undefined ? data.description : existing.description,
      quantity,
      unitPrice,
      paymentPlan,
      lineTotal,
    },
  })
  return recalcContractValue(contractId)
}

export async function deleteContractItem(contractId, itemId) {
  await prisma.contractItem.delete({ where: { id: Number(itemId) } })
  return recalcContractValue(contractId)
}

async function recalcContractValue(contractId) {
  const items = await prisma.contractItem.findMany({ where: { contractId: Number(contractId) } })
  const contractValue = items.reduce((sum, i) => sum + Number(i.lineTotal), 0)
  const contract = await prisma.contract.update({
    where: { id: Number(contractId) },
    data: { contractValue },
    include: CONTRACT_INCLUDE,
  })
  return enrichContract(contract)
}
