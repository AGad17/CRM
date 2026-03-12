import { differenceInMonths, getISOWeek, getMonth, getYear, getQuarter } from 'date-fns'

// ─── Contract Derived Fields ──────────────────────────────────────────────────

export function contractPeriod(startDate, endDate) {
  const months = differenceInMonths(new Date(endDate), new Date(startDate))
  return months < 1 ? 1 : months
}

export function mrr(contractValue, period) {
  if (!period || period === 0) return 0
  return Number(contractValue) / period
}

export function mrrUSD(mrrLocal, usdRate) {
  if (mrrLocal == null || !usdRate) return null
  return mrrLocal / Number(usdRate)
}

export function contractStatus(endDate, cancellationDate) {
  if (cancellationDate) return 'Churned'
  return new Date() <= new Date(endDate) ? 'Active' : 'Inactive'
}

export function churnFlag(cancellationDate) {
  return cancellationDate ? 'Churned' : 'Active'
}

export function startingWeek(startDate) {
  return getISOWeek(new Date(startDate))
}

export function startingMonth(startDate) {
  return getMonth(new Date(startDate)) + 1 // 1-indexed
}

export function startingYear(startDate) {
  return getYear(new Date(startDate))
}

export function startingQuarterYear(startDate) {
  const d = new Date(startDate)
  return `${getYear(d)} Q${getQuarter(d)}`
}

export function cancellationQuarterYear(cancellationDate) {
  if (!cancellationDate) return null
  const d = new Date(cancellationDate)
  return `${getYear(d)} Q${getQuarter(d)}`
}

// ─── Enrich a raw contract from DB with all derived fields ───────────────────

export function enrichContract(contract) {
  const period = contractPeriod(contract.startDate, contract.endDate)
  const mrrValue = mrr(contract.contractValue, period)
  const usdRate = contract.usdRate ? Number(contract.usdRate) : null
  const mrrUSDValue = mrrUSD(mrrValue, usdRate)

  return {
    ...contract,
    contractValue: Number(contract.contractValue),
    usdRate,
    contractPeriod: period,
    mrr: mrrValue,
    arr: mrrValue * 12,
    mrrUSD: mrrUSDValue,
    arrUSD: mrrUSDValue != null ? mrrUSDValue * 12 : null,
    contractValueUSD: usdRate ? Number(contract.contractValue) / usdRate : null,
    contractStatus: contractStatus(contract.endDate, contract.cancellationDate),
    churnFlag: churnFlag(contract.cancellationDate),
    startingWeek: startingWeek(contract.startDate),
    startingMonth: startingMonth(contract.startDate),
    startingYear: startingYear(contract.startDate),
    startingQuarterYear: startingQuarterYear(contract.startDate),
    cancellationQuarterYear: cancellationQuarterYear(contract.cancellationDate),
    account: contract.account
      ? {
          ...contract.account,
          countryCode: contract.account.country?.code,
          currency: contract.account.country?.currency,
        }
      : contract.account,
  }
}

// ─── Account derived status ───────────────────────────────────────────────────

export function accountStatus(contracts) {
  if (!contracts || contracts.length === 0) return 'No Contract'
  const hasActive = contracts.some(
    (c) => !c.cancellationDate && new Date() <= new Date(c.endDate)
  )
  return hasActive ? 'Active' : 'Churned'
}

export function accountChurnDate(contracts) {
  const churned = contracts
    .filter((c) => c.cancellationDate)
    .sort((a, b) => new Date(b.cancellationDate) - new Date(a.cancellationDate))
  return churned.length > 0 ? churned[0].cancellationDate : null
}

// ─── KPI Aggregations ─────────────────────────────────────────────────────────

export function sumMRR(contracts) {
  return contracts.reduce((sum, c) => {
    const period = contractPeriod(c.startDate, c.endDate)
    return sum + mrr(c.contractValue, period)
  }, 0)
}

export function sumMRRUSD(contracts) {
  return contracts.reduce((sum, c) => {
    if (c.mrrUSD == null) return sum
    return sum + c.mrrUSD
  }, 0)
}

export function filterContractsByMonth(contracts, year, month) {
  return contracts.filter((c) => {
    const d = new Date(c.startDate)
    return getYear(d) === year && getMonth(d) + 1 === month
  })
}

export function filterCancelledByMonth(contracts, year, month) {
  return contracts.filter((c) => {
    if (!c.cancellationDate) return false
    const d = new Date(c.cancellationDate)
    return getYear(d) === year && getMonth(d) + 1 === month
  })
}

export function filterContractsByQuarter(contracts, year, quarter) {
  return contracts.filter((c) => {
    const d = new Date(c.startDate)
    return getYear(d) === year && getQuarter(d) === quarter
  })
}

export function filterCancelledByQuarter(contracts, year, quarter) {
  return contracts.filter((c) => {
    if (!c.cancellationDate) return false
    const d = new Date(c.cancellationDate)
    return getYear(d) === year && getQuarter(d) === quarter
  })
}

export function filterContractsByYear(contracts, year) {
  return contracts.filter((c) => getYear(new Date(c.startDate)) === year)
}

export function filterCancelledByYear(contracts, year) {
  return contracts.filter(
    (c) => c.cancellationDate && getYear(new Date(c.cancellationDate)) === year
  )
}

// ─── NRR / GRR helpers ────────────────────────────────────────────────────────

export function calcNRR(priorMRR, expansionMRR, churnedMRR) {
  if (!priorMRR || priorMRR === 0) return null
  return (priorMRR + expansionMRR - churnedMRR) / priorMRR
}

export function calcGRR(priorMRR, churnedMRR) {
  if (!priorMRR || priorMRR === 0) return null
  return Math.min(1, (priorMRR - churnedMRR) / priorMRR)
}

export function calcNetNewMRR(newMRR, expansionMRR, churnedMRR) {
  return newMRR + expansionMRR - churnedMRR
}

export function deltaPercent(current, previous) {
  if (!previous || previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatCurrency(value, currency = 'USD') {
  if (value === null || value === undefined) return '—'
  return `${currency} ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(1)}%`
}
