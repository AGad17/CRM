/**
 * Pure calculation functions for the invoicing feature.
 * No side effects — safe to call in real-time as the user types.
 */

/**
 * @param {object} p
 * @param {number} p.normalBranches
 * @param {number} p.centralKitchens
 * @param {number} p.warehouses
 * @param {string} p.countryCode
 * @param {string} p.package       - Essential | Operations | Enterprise
 * @param {Array}  p.branchPricing - rows from DB
 */
export function calcBranchMRR({ normalBranches, centralKitchens, warehouses, countryCode, package: pkg, branchPricing }) {
  const find = (branchType) =>
    branchPricing.find((r) => r.countryCode === countryCode && r.package === pkg && r.branchType === branchType)

  const normalPrice  = Number(find('Normal')?.price        || 0)
  const ckPrice      = Number(find('CentralKitchen')?.price || 0)
  const warehPrice   = Number(find('Warehouse')?.price      || 0)

  return (normalBranches * normalPrice) + (centralKitchens * ckPrice) + (warehouses * warehPrice)
}

/**
 * @param {object} p
 * @param {boolean} p.hasAccounting
 * @param {number}  p.extraAccountingBranches
 * @param {string}  p.countryCode
 * @param {string}  p.package
 * @param {Array}   p.accountingPricing
 */
export function calcAccountingMRR({ hasAccounting, extraAccountingBranches, countryCode, package: pkg, accountingPricing }) {
  if (!hasAccounting) return 0
  const find = (isMain) =>
    accountingPricing.find((r) => r.countryCode === countryCode && r.package === pkg && r.isMainLicense === isMain)

  const mainPrice  = Number(find(true)?.price  || 0)
  const extraPrice = Number(find(false)?.price || 0)

  return mainPrice + (extraAccountingBranches * extraPrice)
}

/**
 * @param {object} p
 * @param {boolean} p.hasButchering
 * @param {number}  p.aiAgentUsers
 * @param {string}  p.countryCode
 * @param {Array}   p.flatModulePricing
 */
export function calcFlatMRR({ hasButchering, aiAgentUsers, countryCode, flatModulePricing }) {
  const findFlat = (module) =>
    flatModulePricing.find((r) => r.countryCode === countryCode && r.module === module)

  const butcheringPrice = Number(findFlat('Butchering')?.price || 0)
  const aiPrice         = Number(findFlat('AIAgent')?.price    || 0)

  return (hasButchering ? butcheringPrice : 0) + (aiAgentUsers * aiPrice)
}

/**
 * Returns total MRR excluding VAT
 */
export function calcTotalMRR(params) {
  return calcBranchMRR(params) + calcAccountingMRR(params) + calcFlatMRR(params)
}

/**
 * Contract months based on payment type
 * @param {string} paymentType - Annual | Quarterly | Special
 * @param {number} contractYears - only for Special
 */
export function calcContractMonths(paymentType, contractYears = 1) {
  if (paymentType === 'Annual')    return 12
  if (paymentType === 'Quarterly') return 12
  if (paymentType === 'Special')   return contractYears * 12
  return 12
}

/**
 * Contract value excluding VAT
 */
export function calcContractValue(totalMRR, paymentType, contractYears = 1) {
  return totalMRR * calcContractMonths(paymentType, contractYears)
}

/**
 * Full summary of all calculated preview fields
 */
export function calcDealSummary(params) {
  const {
    paymentType,
    contractYears = 1,
    vatRate = 0,
    ...rest
  } = params

  const branchMRR     = calcBranchMRR(rest)
  const accountingMRR = calcAccountingMRR(rest)
  const flatMRR       = calcFlatMRR(rest)
  const totalMRR      = branchMRR + accountingMRR + flatMRR
  const contractMonths = calcContractMonths(paymentType, contractYears)
  const contractValue  = totalMRR * contractMonths
  const vatRateNum     = Number(vatRate)

  return {
    branchMRR,
    accountingMRR,
    flatMRR,
    totalMRR,
    totalMRRInclVAT:      totalMRR * (1 + vatRateNum),
    contractMonths,
    contractValue,
    contractValueInclVAT: contractValue * (1 + vatRateNum),
    quarterlyBilling:     totalMRR * 3,
    quarterlyBillingInclVAT: totalMRR * 3 * (1 + vatRateNum),
    vatRate:              vatRateNum,
  }
}

/**
 * Generate invoice dates for a deal
 * @returns Array of { invoiceDate, amountExclVAT }
 */
export function calcInvoiceDates(startDate, paymentType, totalMRR, contractYears = 1) {
  const start = new Date(startDate)

  if (paymentType === 'Annual') {
    return [{ invoiceDate: start, amountExclVAT: totalMRR * 12 }]
  }

  if (paymentType === 'Quarterly') {
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(start)
      d.setMonth(d.getMonth() + i * 3)
      return { invoiceDate: d, amountExclVAT: totalMRR * 3 }
    })
  }

  if (paymentType === 'Special') {
    return [{ invoiceDate: start, amountExclVAT: totalMRR * contractYears * 12 }]
  }

  return []
}

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
  const year = d.getFullYear()
  const quarter = getQuarterNumber(d)
  const suffix = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')
  return `SB-${year}Q${quarter}-${suffix}`
}
