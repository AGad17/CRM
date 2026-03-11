/**
 * Pure calculation functions for the invoicing feature.
 * No side effects — safe to call in real-time as the user types.
 *
 * Pricing model (new):
 *  - Config stores ANNUAL prices per (country × salesChannel × package/module)
 *  - Quarterly = Annual × 1.06, split into 4 invoices spaced 3 months apart
 *  - Special   = Annual pricing, custom contract length, 1 invoice
 *  - Per-line discounts applied first, then overall deal discount, then quarterly premium
 */

const QUARTERLY_PREMIUM = 1.06

// ─── Annual pricing lookups ────────────────────────────────────────────────────

/**
 * Annual revenue from Normal Branches inventory
 */
export function calcInventoryAnnual({ normalBranches, countryCode, salesChannel, pkg, inventoryPricing }) {
  const row = inventoryPricing.find(
    (r) => r.countryCode === countryCode && r.salesChannel === salesChannel && r.package === pkg
  )
  return Number(row?.annualPrice || 0) * Number(normalBranches || 0)
}

/**
 * Annual revenue from a single add-on module
 */
export function calcAddOnAnnual({ countryCode, salesChannel, module, quantity = 1, addOnPricing }) {
  const row = addOnPricing.find(
    (r) => r.countryCode === countryCode && r.salesChannel === salesChannel && r.module === module
  )
  return Number(row?.annualPrice || 0) * Number(quantity)
}

// ─── Contract months ──────────────────────────────────────────────────────────

/**
 * Contract months based on payment type
 * @param {string} paymentType - Annual | Quarterly | Special
 * @param {number} contractYears - only used for Special
 */
export function calcContractMonths(paymentType, contractYears = 1) {
  if (paymentType === 'Annual')    return 12
  if (paymentType === 'Quarterly') return 12
  if (paymentType === 'Special')   return Number(contractYears) * 12
  return 12
}

// ─── Full deal summary ─────────────────────────────────────────────────────────

/**
 * Full summary of all calculated deal values.
 *
 * Calculation order:
 *   1. Component annual values (before line discount)
 *   2. Apply per-line discounts → effectiveComponentAnnual
 *   3. Sum → baseAnnual
 *   4. Apply overall deal discount → discountedAnnual
 *   5. Apply quarterly premium (if Quarterly) → effectiveAnnual
 *   6. contractValue = effectiveAnnual × contractMonths / 12
 *   7. MRR = effectiveAnnual / 12
 *
 * @param {object} p
 * @param {number}  p.normalBranches
 * @param {number}  p.centralKitchens
 * @param {number}  p.warehouses
 * @param {boolean} p.hasAccounting
 * @param {number}  p.extraAccountingBranches
 * @param {boolean} p.hasButchering
 * @param {number}  p.aiAgentUsers
 * @param {string}  p.countryCode
 * @param {string}  p.salesChannel      - LeadSource value
 * @param {string}  p.package           - Essential | Operations | Enterprise
 * @param {string}  p.paymentType       - Annual | Quarterly | Special
 * @param {number}  p.contractYears     - only for Special
 * @param {number}  p.vatRate           - decimal e.g. 0.14
 * @param {number}  p.discount          - overall deal discount %  e.g. 10 = 10%
 * @param {object}  p.lineDiscounts     - { inventory, ck, warehouse, accMain, accExtra, butchering, ai }  (% values)
 * @param {Array}   p.inventoryPricing  - rows from DB
 * @param {Array}   p.addOnPricing      - rows from DB
 */
export function calcDealSummary({
  normalBranches = 0,
  centralKitchens = 0,
  warehouses = 0,
  hasAccounting = false,
  extraAccountingBranches = 0,
  hasButchering = false,
  aiAgentUsers = 0,
  countryCode,
  salesChannel,
  package: pkg,
  paymentType,
  contractYears = 1,
  vatRate = 0,
  discount = 0,
  lineDiscounts = {},
  inventoryPricing = [],
  addOnPricing = [],
}) {
  // 1. Gross annual amounts per component
  const invGross  = calcInventoryAnnual({ normalBranches, countryCode, salesChannel, pkg, inventoryPricing })
  const ckGross   = Number(centralKitchens) > 0
    ? calcAddOnAnnual({ countryCode, salesChannel, module: 'CentralKitchen', quantity: centralKitchens, addOnPricing }) : 0
  const wGross    = Number(warehouses) > 0
    ? calcAddOnAnnual({ countryCode, salesChannel, module: 'Warehouse', quantity: warehouses, addOnPricing }) : 0
  const accMainGross  = hasAccounting
    ? calcAddOnAnnual({ countryCode, salesChannel, module: 'AccountingMain', quantity: 1, addOnPricing }) : 0
  const accExtraGross = hasAccounting && Number(extraAccountingBranches) > 0
    ? calcAddOnAnnual({ countryCode, salesChannel, module: 'AccountingExtra', quantity: extraAccountingBranches, addOnPricing }) : 0
  const butchGross = hasButchering
    ? calcAddOnAnnual({ countryCode, salesChannel, module: 'Butchering', quantity: 1, addOnPricing }) : 0
  const aiGross   = Number(aiAgentUsers) > 0
    ? calcAddOnAnnual({ countryCode, salesChannel, module: 'AIAgent', quantity: aiAgentUsers, addOnPricing }) : 0

  // 2. Apply per-line discounts
  const pct = (g, key) => g * (1 - Number(lineDiscounts[key] || 0) / 100)
  const invNet      = pct(invGross,      'inventory')
  const ckNet       = pct(ckGross,       'ck')
  const wNet        = pct(wGross,        'warehouse')
  const accMainNet  = pct(accMainGross,  'accMain')
  const accExtraNet = pct(accExtraGross, 'accExtra')
  const butchNet    = pct(butchGross,    'butchering')
  const aiNet       = pct(aiGross,       'ai')

  // 3. Base annual = sum of net component values
  const baseAnnual = invNet + ckNet + wNet + accMainNet + accExtraNet + butchNet + aiNet

  // 4. Overall deal discount
  const discountAmt      = baseAnnual * (Number(discount || 0) / 100)
  const discountedAnnual = baseAnnual - discountAmt

  // 5. Quarterly premium
  const isQuarterly     = paymentType === 'Quarterly'
  const effectiveAnnual = isQuarterly ? discountedAnnual * QUARTERLY_PREMIUM : discountedAnnual

  // 6. Contract value
  const contractMonths        = calcContractMonths(paymentType, contractYears)
  const contractValue         = effectiveAnnual * contractMonths / 12
  const vatRateNum            = Number(vatRate || 0)
  const vatAmount             = contractValue * vatRateNum
  const contractValueInclVAT  = contractValue + vatAmount

  // 7. MRR
  const totalMRR          = effectiveAnnual / 12
  const totalMRRInclVAT   = totalMRR * (1 + vatRateNum)

  // Quarterly per-invoice amounts
  const quarterlyBilling          = isQuarterly ? effectiveAnnual / 4 : null
  const quarterlyBillingInclVAT   = quarterlyBilling != null ? quarterlyBilling * (1 + vatRateNum) : null

  return {
    // Gross per component (before line discount)
    invGross, ckGross, wGross, accMainGross, accExtraGross, butchGross, aiGross,
    // Net per component (after line discount)
    invNet, ckNet, wNet, accMainNet, accExtraNet, butchNet, aiNet,
    // Aggregates
    baseAnnual,
    discountAmt,
    discountedAnnual,
    effectiveAnnual,
    // Output fields
    totalMRR,
    totalMRRInclVAT,
    contractMonths,
    contractValue,
    contractValueInclVAT,
    quarterlyBilling,
    quarterlyBillingInclVAT,
    vatRate: vatRateNum,
    discount: Number(discount || 0),
    lineDiscounts,
  }
}

// ─── Invoice date schedule ────────────────────────────────────────────────────

/**
 * Generate invoice schedule for a deal.
 *
 * @param {string} startDate
 * @param {string} paymentType  - Annual | Quarterly | Special
 * @param {number} effectiveAnnual - post-discount, post-premium annual value (excl. VAT)
 * @param {number} contractYears   - only for Special
 * @returns Array of { invoiceDate, amountExclVAT }
 */
export function calcInvoiceDates(startDate, paymentType, effectiveAnnual, contractYears = 1) {
  const start = new Date(startDate)

  if (paymentType === 'Annual') {
    return [{ invoiceDate: start, amountExclVAT: effectiveAnnual }]
  }

  if (paymentType === 'Quarterly') {
    // 4 invoices, each = effectiveAnnual / 4, spaced 3 months apart
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(start)
      d.setMonth(d.getMonth() + i * 3)
      return { invoiceDate: d, amountExclVAT: effectiveAnnual / 4 }
    })
  }

  if (paymentType === 'Special') {
    // 1 invoice for full contract value = effectiveAnnual × years
    return [{ invoiceDate: start, amountExclVAT: effectiveAnnual * Number(contractYears) }]
  }

  return []
}

// ─── Invoice numbering ────────────────────────────────────────────────────────

/**
 * Derive quarter number (1–4) from a date
 */
export function getQuarterNumber(date) {
  return Math.floor(new Date(date).getMonth() / 3) + 1
}

/**
 * Generate a unique SB invoice number candidate
 * Format: SB-{YEAR}Q{QUARTER}-{4-digit-random}
 */
export function generateInvoiceNumber(date) {
  const d = new Date(date)
  const year    = d.getFullYear()
  const quarter = getQuarterNumber(d)
  const suffix  = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')
  return `SB-${year}Q${quarter}-${suffix}`
}
