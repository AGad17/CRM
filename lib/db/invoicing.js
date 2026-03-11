import { prisma } from '@/lib/prisma'
import { calcDealSummary, calcInvoiceDates, getQuarterNumber, generateInvoiceNumber } from '@/lib/invoicingCalc'

// ─── Pricing Config ───────────────────────────────────────────────────────────

/**
 * Returns current (active) pricing rows and country metadata.
 * "Active" = effectiveTo IS NULL
 */
export async function getPricingConfig() {
  const [inventoryPricing, addOnPricing, countries] = await Promise.all([
    prisma.inventoryPricing.findMany({
      where: { effectiveTo: null },
      orderBy: [{ countryCode: 'asc' }, { salesChannel: 'asc' }, { package: 'asc' }],
    }),
    prisma.addOnPricing.findMany({
      where: { effectiveTo: null },
      orderBy: [{ countryCode: 'asc' }, { salesChannel: 'asc' }, { module: 'asc' }],
    }),
    prisma.country.findMany({
      where: { isActive: true },
      select: { code: true, name: true, currency: true, vatRate: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return { inventoryPricing, addOnPricing, countries }
}

/**
 * Save new inventory pricing rows.
 * For each row: expire any current active row (effectiveTo = now),
 * then create a new active row.
 *
 * @param {Array} rows  - [{ countryCode, salesChannel, package, annualPrice, currency }]
 */
export async function saveInventoryPricing(rows) {
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      // Expire existing active row(s) for this key
      await tx.inventoryPricing.updateMany({
        where: {
          countryCode:  row.countryCode,
          salesChannel: row.salesChannel,
          package:      row.package,
          effectiveTo:  null,
        },
        data: { effectiveTo: now },
      })
      // Create new active row
      await tx.inventoryPricing.create({
        data: {
          countryCode:  row.countryCode,
          salesChannel: row.salesChannel,
          package:      row.package,
          annualPrice:  Number(row.annualPrice),
          currency:     row.currency,
          effectiveFrom: now,
          effectiveTo:   null,
        },
      })
    }
  })
  return getPricingConfig()
}

/**
 * Save new add-on pricing rows.
 * Expire old + create new (pricing history pattern).
 *
 * @param {Array} rows  - [{ countryCode, salesChannel, module, annualPrice, currency }]
 */
export async function saveAddOnPricing(rows) {
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.addOnPricing.updateMany({
        where: {
          countryCode:  row.countryCode,
          salesChannel: row.salesChannel,
          module:       row.module,
          effectiveTo:  null,
        },
        data: { effectiveTo: now },
      })
      await tx.addOnPricing.create({
        data: {
          countryCode:  row.countryCode,
          salesChannel: row.salesChannel,
          module:       row.module,
          annualPrice:  Number(row.annualPrice),
          currency:     row.currency,
          effectiveFrom: now,
          effectiveTo:   null,
        },
      })
    }
  })
  return getPricingConfig()
}

export async function updateCountryVAT(countryCode, vatRate) {
  await prisma.country.update({ where: { code: countryCode }, data: { vatRate: Number(vatRate) } })
  return getPricingConfig()
}

// ─── Pricing History ──────────────────────────────────────────────────────────

/**
 * All historical pricing rows (both inventory and add-on).
 * Returns a unified list sorted by effectiveFrom desc.
 */
export async function getPricingHistory(filters = {}) {
  const [inventoryRows, addOnRows] = await Promise.all([
    prisma.inventoryPricing.findMany({
      where: filters.countryCode ? { countryCode: filters.countryCode } : {},
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.addOnPricing.findMany({
      where: filters.countryCode ? { countryCode: filters.countryCode } : {},
      orderBy: { effectiveFrom: 'desc' },
    }),
  ])

  const inventory = inventoryRows.map((r) => ({
    ...r,
    type: 'Inventory',
    label: `${r.package} Plan`,
    annualPrice: Number(r.annualPrice),
    isActive: r.effectiveTo === null,
  }))
  const addOns = addOnRows.map((r) => ({
    ...r,
    type: 'AddOn',
    label: r.module,
    annualPrice: Number(r.annualPrice),
    isActive: r.effectiveTo === null,
  }))

  return [...inventory, ...addOns].sort(
    (a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom)
  )
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
  if (filters.agentId)     where.agentId     = filters.agentId
  if (filters.countryCode) where.countryCode  = filters.countryCode

  const deals = await prisma.deal.findMany({
    where,
    include: {
      agent:    { select: { id: true, name: true, email: true } },
      invoices: { select: { id: true, invoiceNumber: true, status: true, amountInclVAT: true, invoiceDate: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return deals
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
  if (patch.status !== undefined)                 allowed.status = patch.status
  if (patch.collectionDate !== undefined)         allowed.collectionDate = patch.collectionDate ? new Date(patch.collectionDate) : null
  if (patch.foodicsInvoiceNumber !== undefined)   allowed.foodicsInvoiceNumber = patch.foodicsInvoiceNumber

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
    const overdue     = invoices
      .filter((i) => i.status === 'Eligible' && i.eligibleCollectionDate && new Date(i.eligibleCollectionDate) < today)
      .reduce((s, i) => s + Number(i.amountInclVAT), 0)

    const countPending   = invoices.filter((i) => i.status === 'Pending').length
    const countEligible  = invoices.filter((i) => i.status === 'Eligible').length
    const countCollected = invoices.filter((i) => i.status === 'Collected').length
    const countOverdue   = invoices.filter(
      (i) => i.status === 'Eligible' && i.eligibleCollectionDate && new Date(i.eligibleCollectionDate) < today
    ).length

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
