import { prisma } from '../prisma'
import {
  enrichContract,
  contractPeriod,
  mrr,
  sumMRR,
  filterContractsByMonth,
  filterCancelledByMonth,
  filterContractsByQuarter,
  filterCancelledByQuarter,
  filterContractsByYear,
  filterCancelledByYear,
  calcNRR,
  calcGRR,
  calcNetNewMRR,
  deltaPercent,
} from '../calculations'
import { getYear, getQuarter, getMonth, subMonths, subQuarters, subYears } from 'date-fns'

async function getAllContracts() {
  const raw = await prisma.contract.findMany({
    include: { account: { select: { id: true, name: true, country: true, leadSource: true } } },
  })
  return raw.map(enrichContract)
}

async function getAllAccounts() {
  return prisma.account.findMany({ include: { contracts: true } })
}

// ─── CCO Dashboard ────────────────────────────────────────────────────────────

export async function getDashboardKPIs() {
  const [accounts, contracts] = await Promise.all([getAllAccounts(), getAllContracts()])

  const activeAccounts = accounts.filter((a) =>
    a.contracts.some((c) => !c.cancellationDate && new Date() <= new Date(c.endDate))
  )
  const churnedAccounts = accounts.filter(
    (a) => !a.contracts.some((c) => !c.cancellationDate && new Date() <= new Date(c.endDate))
  )
  const activeContracts = contracts.filter((c) => c.contractStatus === 'Active')
  const totalMRR = sumMRR(activeContracts)

  // Build last 3 months + prior month data
  const now = new Date()
  const months = [0, 1, 2, 3].map((i) => {
    const d = subMonths(now, i)
    return { year: getYear(d), month: getMonth(d) + 1, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }) }
  })

  const monthlyData = months.map(({ year, month, label }) => {
    const started = filterContractsByMonth(contracts, year, month)
    const cancelled = filterCancelledByMonth(contracts, year, month)

    const newMRR = sumMRR(started.filter((c) => c.type === 'New'))
    const renewalMRR = sumMRR(started.filter((c) => c.type === 'Renewal'))
    const expansionMRR = sumMRR(started.filter((c) => c.type === 'Expansion'))
    const churnedMRR = sumMRR(cancelled)
    const totalMRRSigned = newMRR + renewalMRR + expansionMRR

    // Prior MRR = all active contracts at start of this month
    const priorMRR = sumMRR(
      contracts.filter((c) => {
        const sd = new Date(c.startDate)
        const ed = new Date(c.endDate)
        const targetStart = new Date(year, month - 1, 1)
        return sd < targetStart && ed >= targetStart && !c.cancellationDate
      })
    )

    return {
      label,
      year,
      month,
      newMRR,
      renewalMRR,
      expansionMRR,
      churnedMRR,
      totalMRRSigned,
      netNewMRR: calcNetNewMRR(newMRR, expansionMRR, churnedMRR),
      newContracts: started.filter((c) => c.type === 'New').length,
      churnedContracts: cancelled.length,
      contractValue: started.reduce((s, c) => s + Number(c.contractValue), 0),
      nrr: calcNRR(priorMRR, expansionMRR, churnedMRR),
      grr: calcGRR(priorMRR, churnedMRR),
    }
  })

  const [current, prev1, prev2, prior] = monthlyData

  return {
    snapshot: {
      totalAccounts: accounts.length,
      activeAccounts: activeAccounts.length,
      churnedAccounts: churnedAccounts.length,
      overallChurnRate: accounts.length > 0 ? churnedAccounts.length / accounts.length : 0,
      totalContracts: contracts.length,
      activeContracts: activeContracts.length,
      totalMRR,
      totalARR: totalMRR * 12,
      totalContractValue: contracts.reduce((s, c) => s + Number(c.contractValue), 0),
      avgMRRPerContract: contracts.length > 0 ? totalMRR / contracts.length : 0,
      countriesServed: new Set(accounts.map((a) => a.country)).size,
      totalBrands: accounts.reduce((s, a) => s + (a.brands || 0), 0),
      totalBranches: accounts.reduce((s, a) => s + (a.numberOfBranches || 0), 0),
    },
    recentMonths: [current, prev1, prev2],
    priorMonth: prior,
  }
}

// ─── Period Aggregation Helper ────────────────────────────────────────────────

function buildPeriodRow(label, started, cancelled, prevStarted) {
  const newMRR = sumMRR(started.filter((c) => c.type === 'New'))
  const renewalMRR = sumMRR(started.filter((c) => c.type === 'Renewal'))
  const expansionMRR = sumMRR(started.filter((c) => c.type === 'Expansion'))
  const totalMRRSigned = newMRR + renewalMRR + expansionMRR
  const churnedMRR = sumMRR(cancelled)
  const churnedCount = cancelled.length
  const newAccounts = started.filter((c) => c.type === 'New').length
  const totalContracts = started.length
  const contractValue = started.reduce((s, c) => s + Number(c.contractValue), 0)
  const prevTotalMRR = prevStarted ? sumMRR(prevStarted) : 0
  const prevNewAccounts = prevStarted ? prevStarted.filter((c) => c.type === 'New').length : 0
  const prevContractValue = prevStarted ? prevStarted.reduce((s, c) => s + Number(c.contractValue), 0) : 0
  const priorMRR = prevTotalMRR

  return {
    period: label,
    newMRR,
    renewalMRR,
    expansionMRR,
    totalMRRSigned,
    newAccounts,
    totalContracts,
    churnedMRR,
    churnedAccounts: churnedCount,
    contractValue,
    deltaTotalMRR: deltaPercent(totalMRRSigned, prevTotalMRR),
    deltaNewAccounts: deltaPercent(newAccounts, prevNewAccounts),
    netNewMRR: calcNetNewMRR(newMRR, expansionMRR, churnedMRR),
    deltaContractValue: deltaPercent(contractValue, prevContractValue),
    nrr: calcNRR(priorMRR, expansionMRR, churnedMRR),
    grr: calcGRR(priorMRR, churnedMRR),
    arr: totalMRRSigned * 12,
  }
}

// ─── YoY ──────────────────────────────────────────────────────────────────────

export async function getYoY() {
  const contracts = await getAllContracts()
  const years = [...new Set(contracts.map((c) => c.startingYear))].sort()

  return years.map((year, i) => {
    const started = filterContractsByYear(contracts, year)
    const cancelled = filterCancelledByYear(contracts, year)
    const prevStarted = i > 0 ? filterContractsByYear(contracts, years[i - 1]) : null
    return buildPeriodRow(String(year), started, cancelled, prevStarted)
  })
}

// ─── QoQ ──────────────────────────────────────────────────────────────────────

export async function getQoQ() {
  const contracts = await getAllContracts()
  const quarters = [...new Set(contracts.map((c) => c.startingQuarterYear))].sort()

  return quarters.map((qLabel, i) => {
    const [year, q] = qLabel.split(' Q').map(Number)
    const started = filterContractsByQuarter(contracts, year, q)
    const cancelled = filterCancelledByQuarter(contracts, year, q)
    let prevStarted = null
    if (i > 0) {
      const [py, pq] = quarters[i - 1].split(' Q').map(Number)
      prevStarted = filterContractsByQuarter(contracts, py, pq)
    }
    return buildPeriodRow(qLabel, started, cancelled, prevStarted)
  })
}

// ─── MoM ──────────────────────────────────────────────────────────────────────

export async function getMoM() {
  const contracts = await getAllContracts()
  const monthKeys = [...new Set(
    contracts.map((c) => `${c.startingYear}-${String(c.startingMonth).padStart(2, '0')}`)
  )].sort()

  return monthKeys.map((key, i) => {
    const [year, month] = key.split('-').map(Number)
    const started = filterContractsByMonth(contracts, year, month)
    const cancelled = filterCancelledByMonth(contracts, year, month)
    let prevStarted = null
    if (i > 0) {
      const [py, pm] = monthKeys[i - 1].split('-').map(Number)
      prevStarted = filterContractsByMonth(contracts, py, pm)
    }
    return buildPeriodRow(key, started, cancelled, prevStarted)
  })
}

// ─── Segments ─────────────────────────────────────────────────────────────────

export async function getSegments() {
  const accounts = await getAllAccounts()
  const contracts = await getAllContracts()

  const activeContracts = contracts.filter((c) => c.contractStatus === 'Active')

  const enriched = accounts.map((a) => {
    const isActive = a.contracts.some(
      (c) => !c.cancellationDate && new Date() <= new Date(c.endDate)
    )
    return { ...a, isActive }
  })

  const totalMRR = sumMRR(activeContracts)

  // By Country
  const countries = [...new Set(accounts.map((a) => a.country))]
  const byCountry = countries.map((country) => {
    const accs = enriched.filter((a) => a.country === country)
    const ctrcts = activeContracts.filter((c) => c.account?.country === country)
    const mrrVal = sumMRR(ctrcts)
    const active = accs.filter((a) => a.isActive).length
    const churned = accs.filter((a) => !a.isActive).length
    return {
      country,
      totalMRR: mrrVal,
      contracts: ctrcts.length,
      contractValue: ctrcts.reduce((s, c) => s + Number(c.contractValue), 0),
      activeAccounts: active,
      churnedAccounts: churned,
      churnRate: accs.length > 0 ? churned / accs.length : 0,
      percentOfTotalMRR: totalMRR > 0 ? mrrVal / totalMRR : 0,
    }
  })

  // By Lead Source
  const sources = [...new Set(accounts.map((a) => a.leadSource))]
  const byLeadSource = sources.map((source) => {
    const accs = enriched.filter((a) => a.leadSource === source)
    const active = accs.filter((a) => a.isActive).length
    const churned = accs.filter((a) => !a.isActive).length
    return {
      leadSource: source,
      total: accs.length,
      active,
      churned,
      churnRate: accs.length > 0 ? churned / accs.length : 0,
      percentOfTotal: accounts.length > 0 ? accs.length / accounts.length : 0,
    }
  })

  return { byCountry, byLeadSource }
}

// ─── Churn Analysis ───────────────────────────────────────────────────────────

export async function getChurnAnalysis() {
  const contracts = await getAllContracts()
  const accounts = await getAllAccounts()

  const quarters = [...new Set(contracts.map((c) => c.startingQuarterYear))].sort()

  const byQuarter = quarters.map((qLabel) => {
    const [year, q] = qLabel.split(' Q').map(Number)
    const qStart = new Date(year, (q - 1) * 3, 1)
    const qEnd = new Date(year, q * 3, 1)

    const activeAtStart = contracts.filter((c) => {
      const sd = new Date(c.startDate)
      const ed = new Date(c.endDate)
      return sd < qStart && ed >= qStart && !c.cancellationDate
    })

    const newLogos = contracts.filter((c) => {
      const sd = new Date(c.startDate)
      return sd >= qStart && sd < qEnd && c.type === 'New'
    })

    const churnedLogos = contracts.filter((c) => {
      if (!c.cancellationDate) return false
      const cd = new Date(c.cancellationDate)
      return cd >= qStart && cd < qEnd
    })

    const activeStart = activeAtStart.length
    const logoChurnRate = activeStart > 0 ? churnedLogos.length / activeStart : 0

    // Avg lifespan for churned in this quarter
    const lifespans = churnedLogos
      .filter((c) => c.cancellationDate)
      .map((c) => contractPeriod(c.startDate, c.cancellationDate))
    const avgLifespan = lifespans.length > 0 ? lifespans.reduce((s, v) => s + v, 0) / lifespans.length : null

    return {
      quarter: qLabel,
      activeAtStart,
      newLogos: newLogos.length,
      churnedLogos: churnedLogos.length,
      logoChurnRate,
      avgLifespan,
    }
  })

  // By Lead Source
  const sources = [...new Set(accounts.map((a) => a.leadSource))]
  const byLeadSource = sources.map((source) => {
    const accs = accounts.filter((a) => a.leadSource === source)
    const churned = accs.filter(
      (a) => !a.contracts.some((c) => !c.cancellationDate && new Date() <= new Date(c.endDate))
    )
    return {
      leadSource: source,
      totalAccounts: accs.length,
      active: accs.length - churned.length,
      churned: churned.length,
      churnRate: accs.length > 0 ? churned.length / accs.length : 0,
    }
  })

  return { byQuarter, byLeadSource }
}

// ─── Revenue Quality ──────────────────────────────────────────────────────────

export async function getRevenueQuality() {
  const accounts = await getAllAccounts()
  const contracts = await getAllContracts()
  const activeContracts = contracts.filter((c) => c.contractStatus === 'Active')
  const totalMRR = sumMRR(activeContracts)

  const concentration = accounts
    .map((a) => {
      const accts = activeContracts.filter((c) => c.accountId === a.id)
      const mrrVal = sumMRR(accts)
      return { id: a.id, name: a.name, mrr: mrrVal, percentOfTotal: totalMRR > 0 ? mrrVal / totalMRR : 0 }
    })
    .filter((r) => r.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr)
    .map((r, i, arr) => ({
      ...r,
      rank: i + 1,
      cumulativePercent: arr.slice(0, i + 1).reduce((s, x) => s + x.percentOfTotal, 0),
    }))

  const quarters = [...new Set(contracts.map((c) => c.startingQuarterYear))].sort()
  const mrrPerBranch = quarters.map((qLabel) => {
    const [year, q] = qLabel.split(' Q').map(Number)
    const qStart = new Date(year, (q - 1) * 3, 1)
    const qEnd = new Date(year, q * 3, 1)

    const activeAccs = accounts.filter((a) =>
      a.contracts.some((c) => {
        const sd = new Date(c.startDate)
        return sd >= qStart && sd < qEnd
      })
    )
    const qContracts = activeContracts.filter((c) => {
      const sd = new Date(c.startDate)
      return sd >= qStart && sd < qEnd
    })
    const mrrVal = sumMRR(qContracts)
    const accCount = activeAccs.length

    return {
      quarter: qLabel,
      totalMRR: mrrVal,
      activeAccounts: accCount,
      avgMRRPerAccount: accCount > 0 ? mrrVal / accCount : 0,
      arr: mrrVal * 12,
    }
  })

  return { concentration, mrrPerBranch }
}

// ─── MRR Cohort Retention ─────────────────────────────────────────────────────

export async function getCohorts() {
  const contracts = await getAllContracts()

  const cohortKeys = [...new Set(contracts.map((c) => c.startingQuarterYear))].sort()

  return cohortKeys.map((cohort) => {
    const [year, q] = cohort.split(' Q').map(Number)
    const cohortStart = new Date(year, (q - 1) * 3, 1)

    const cohortContracts = contracts.filter((c) => c.startingQuarterYear === cohort)
    const initialMRR = sumMRR(cohortContracts)
    const initialAccounts = new Set(cohortContracts.map((c) => c.accountId)).size

    const retention = {}
    for (let i = 1; i <= 6; i++) {
      const checkDate = new Date(cohortStart)
      checkDate.setMonth(checkDate.getMonth() + i * 3)

      const activeMRR = sumMRR(
        cohortContracts.filter((c) => {
          const ed = new Date(c.endDate)
          const cd = c.cancellationDate ? new Date(c.cancellationDate) : null
          return ed >= checkDate && (!cd || cd > checkDate)
        })
      )
      retention[`q${i}`] = initialMRR > 0 ? activeMRR / initialMRR : null
    }

    return { cohort, initialMRR, initialAccounts, ...retention }
  })
}
