import { prisma } from '@/lib/prisma'
import { calcDealSummary, calcInvoiceDates, getQuarterNumber, generateInvoiceNumber } from '@/lib/invoicingCalc'

// ─── Pricing Config ───────────────────────────────────────────────────────────

export async function getPricingConfig() {
  const [branchPricing, accountingPricing, flatModulePricing, countries] = await Promise.all([
    prisma.branchPricing.findMany({ orderBy: [{ countryCode: 'asc' }, { package: 'asc' }, { branchType: 'asc' }] }),
    prisma.accountingPricing.findMany({ orderBy: [{ countryCode: 'asc' }, { package: 'asc' }] }),
    prisma.flatModulePricing.findMany({ orderBy: [{ countryCode: 'asc' }, { module: 'asc' }] }),
    prisma.country.findMany({ where: { isActive: true }, select: { code: true, name: true, currency: true, vatRate: true }, orderBy: { name: 'asc' } }),
  ])
  return { branchPricing, accountingPricing, flatModulePricing, countries }
}

export async function upsertBranchPricing(rows) {
  // rows: [{ countryCode, package, branchType, price, currency }]
  for (const row of rows) {
    await prisma.branchPricing.upsert({
      where: { countryCode_package_branchType: { countryCode: row.countryCode, package: row.package, branchType: row.branchType } },
      create: row,
      update: { price: row.price, currency: row.currency },
    })
  }
  return getPricingConfig()
}

export async function upsertAccountingPricing(rows) {
  for (const row of rows) {
    await prisma.accountingPricing.upsert({
      where: { countryCode_package_isMainLicense: { countryCode: row.countryCode, package: row.package, isMainLicense: row.isMainLicense } },
      create: row,
      update: { price: row.price, currency: row.currency },
    })
  }
  return getPricingConfig()
}

export async function upsertFlatModulePricing(rows) {
  for (const row of rows) {
    await prisma.flatModulePricing.upsert({
      where: { countryCode_module: { countryCode: row.countryCode, module: row.module } },
      create: row,
      update: { price: row.price, currency: row.currency },
    })
  }
  return getPricingConfig()
}

export async function updateCountryVAT(countryCode, vatRate) {
  await prisma.country.update({ where: { code: countryCode }, data: { vatRate: Number(vatRate) } })
  return getPricingConfig()
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export async function getActiveAgents() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
}

// ─── Deals (Sales Log) ────────────────────────────────────────────────────────

export async function getDeals(filters = {}) {
  const where = {}
  if (filters.agentId) where.agentId = filters.agentId
  if (filters.countryCode) where.countryCode = filters.countryCode

  const deals = await prisma.deal.findMany({
    where,
    include: {
      agent: { select: { id: true, name: true, email: true } },
      invoices: { select: { id: true, invoiceNumber: true, status: true, amountInclVAT: true, invoiceDate: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return deals
}

export async function createDeal(data) {
  const {
    startDate,
    agentId,
    accountName,
    brandNames,
    numberOfBrands = 1,
    dealType,
    posSystem,
    countryCode,
    salesChannel,
    package: pkg,
    paymentType,
    contractYears = 1,
    normalBranches = 0,
    centralKitchens = 0,
    warehouses = 0,
    hasAccounting = false,
    extraAccountingBranches = 0,
    hasButchering = false,
    aiAgentUsers = 0,
    notes,
    accountId,
  } = data

  // Load pricing config for calculations
  const config = await getPricingConfig()
  const countryConfig = config.countries.find((c) => c.code === countryCode)
  const vatRate = Number(countryConfig?.vatRate || 0)

  // Compute summary
  const summary = calcDealSummary({
    normalBranches: Number(normalBranches),
    centralKitchens: Number(centralKitchens),
    warehouses: Number(warehouses),
    hasAccounting,
    extraAccountingBranches: Number(extraAccountingBranches),
    hasButchering,
    aiAgentUsers: Number(aiAgentUsers),
    countryCode,
    package: pkg,
    paymentType,
    contractYears: Number(contractYears),
    vatRate,
    branchPricing: config.branchPricing,
    accountingPricing: config.accountingPricing,
    flatModulePricing: config.flatModulePricing,
  })

  // Build invoice rows with unique numbers
  const invoiceDates = calcInvoiceDates(startDate, paymentType, summary.totalMRR, Number(contractYears))
  const invoiceRows = []

  for (const { invoiceDate, amountExclVAT } of invoiceDates) {
    let invoiceNumber
    let attempts = 0
    do {
      invoiceNumber = generateInvoiceNumber(invoiceDate)
      const exists = await prisma.invoice.findUnique({ where: { invoiceNumber } })
      if (!exists) break
      attempts++
    } while (attempts < 20)

    const vatAmount = amountExclVAT * vatRate
    const amountInclVAT = amountExclVAT + vatAmount
    const eligibleCollectionDate = posSystem === 'Foodics'
      ? new Date(new Date(invoiceDate).getTime() + 38 * 24 * 60 * 60 * 1000)
      : null

    invoiceRows.push({
      invoiceNumber,
      accountName,
      posSystem,
      countryCode,
      paymentType,
      dealDate: new Date(startDate),
      invoiceDate: new Date(invoiceDate),
      quarterNumber: getQuarterNumber(invoiceDate),
      amountExclVAT,
      vatRate,
      vatAmount,
      amountInclVAT,
      eligibleCollectionDate,
      status: 'Pending',
    })
  }

  // Persist deal + invoices atomically
  const deal = await prisma.deal.create({
    data: {
      startDate: new Date(startDate),
      agentId,
      accountName,
      brandNames,
      numberOfBrands: Number(numberOfBrands),
      dealType,
      posSystem,
      countryCode,
      salesChannel,
      package: pkg,
      paymentType,
      contractYears: paymentType === 'Special' ? Number(contractYears) : null,
      normalBranches: Number(normalBranches),
      centralKitchens: Number(centralKitchens),
      warehouses: Number(warehouses),
      hasAccounting,
      extraAccountingBranches: Number(extraAccountingBranches),
      hasButchering,
      aiAgentUsers: Number(aiAgentUsers),
      notes,
      totalMRR: summary.totalMRR,
      vatRate: summary.vatRate,
      totalMRRInclVAT: summary.totalMRRInclVAT,
      contractMonths: summary.contractMonths,
      contractValue: summary.contractValue,
      contractValueInclVAT: summary.contractValueInclVAT,
      accountId: accountId ? Number(accountId) : null,
      invoices: { create: invoiceRows },
    },
    include: {
      agent: { select: { id: true, name: true } },
      invoices: true,
    },
  })

  return deal
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

/**
 * view: 'foodicsAR' | 'foodicsHistory' | 'directAR' | 'fullHistory'
 */
export async function getInvoices(view = 'foodicsAR') {
  let where = {}

  if (view === 'foodicsAR') {
    where = { posSystem: 'Foodics', status: { not: 'Collected' } }
  } else if (view === 'foodicsHistory') {
    where = { posSystem: 'Foodics', status: 'Collected' }
  } else if (view === 'directAR') {
    where = { posSystem: { in: ['Geidea', 'Sonic'] }, status: { not: 'Collected' } }
  } else if (view === 'fullHistory') {
    where = { status: 'Collected' }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      deal: { select: { id: true, agentId: true, agent: { select: { name: true } } } },
    },
    orderBy: { invoiceDate: 'desc' },
  })

  const today = new Date()
  return invoices.map((inv) => ({
    ...inv,
    daysUntilEligible: inv.eligibleCollectionDate && inv.status !== 'Collected'
      ? Math.ceil((new Date(inv.eligibleCollectionDate) - today) / (1000 * 60 * 60 * 24))
      : null,
    collectionCycleDays: inv.collectionDate && inv.invoiceDate
      ? Math.ceil((new Date(inv.collectionDate) - new Date(inv.invoiceDate)) / (1000 * 60 * 60 * 24))
      : null,
    isOverdue: inv.eligibleCollectionDate && inv.status === 'Eligible' && new Date(inv.eligibleCollectionDate) < today,
  }))
}

export async function updateInvoice(id, patch) {
  const allowed = {}
  if (patch.status !== undefined) allowed.status = patch.status
  if (patch.collectionDate !== undefined) allowed.collectionDate = patch.collectionDate ? new Date(patch.collectionDate) : null
  if (patch.foodicsInvoiceNumber !== undefined) allowed.foodicsInvoiceNumber = patch.foodicsInvoiceNumber

  const invoice = await prisma.invoice.update({
    where: { id: Number(id) },
    data: allowed,
  })
  return invoice
}

// ─── AR Report ────────────────────────────────────────────────────────────────

export async function getARReport() {
  const today = new Date()
  const allInvoices = await prisma.invoice.findMany({
    select: { posSystem: true, status: true, amountInclVAT: true, eligibleCollectionDate: true },
  })

  function summarise(invoices) {
    const total       = invoices.reduce((s, i) => s + Number(i.amountInclVAT), 0)
    const pending     = invoices.filter((i) => i.status === 'Pending').reduce((s, i) => s + Number(i.amountInclVAT), 0)
    const eligible    = invoices.filter((i) => i.status === 'Eligible').reduce((s, i) => s + Number(i.amountInclVAT), 0)
    const collected   = invoices.filter((i) => i.status === 'Collected').reduce((s, i) => s + Number(i.amountInclVAT), 0)
    const outstanding = pending + eligible
    const overdue     = invoices.filter((i) => i.status === 'Eligible' && i.eligibleCollectionDate && new Date(i.eligibleCollectionDate) < today)
      .reduce((s, i) => s + Number(i.amountInclVAT), 0)

    const countPending   = invoices.filter((i) => i.status === 'Pending').length
    const countEligible  = invoices.filter((i) => i.status === 'Eligible').length
    const countCollected = invoices.filter((i) => i.status === 'Collected').length
    const countOverdue   = invoices.filter((i) => i.status === 'Eligible' && i.eligibleCollectionDate && new Date(i.eligibleCollectionDate) < today).length

    return { total, pending, eligible, collected, outstanding, overdue, countPending, countEligible, countCollected, countOverdue }
  }

  const foodics = allInvoices.filter((i) => i.posSystem === 'Foodics')
  const direct  = allInvoices.filter((i) => i.posSystem !== 'Foodics')

  return {
    all:     summarise(allInvoices),
    foodics: summarise(foodics),
    direct:  summarise(direct),
  }
}
