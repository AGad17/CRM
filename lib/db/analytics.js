import { prisma } from '../prisma'
import {
  enrichContract,
  contractPeriod,
  mrr,
  sumMRR,
  sumMRRUSD,
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
import { getYear, getQuarter, getMonth, subMonths } from 'date-fns'

async function getAllContracts(filters = {}) {
  const where = {}
  const accountWhere = {}
  if (filters.country) accountWhere.country = { code: filters.country }
  if (filters.leadSource) accountWhere.leadSource = filters.leadSource
  if (Object.keys(accountWhere).length > 0) where.account = accountWhere
  const raw = await prisma.contract.findMany({
    where,
    include: {
      account: {
        select: {
          id: true,
          name: true,
          leadSource: true,
          country: { select: { id: true, code: true, name: true, currency: true } },
        },
      },
    },
  })
  return raw.map(enrichContract)
}

async function getAllAccounts(filters = {}) {
  const where = {}
  if (filters.country) where.country = { code: filters.country }
  if (filters.leadSource) where.leadSource = filters.leadSource
  return prisma.account.findMany({
    where,
    include: {
      contracts: true,
      country: { select: { id: true, code: true, name: true, currency: true } },
    },
  })
}

// ─── CCO Dashboard ────────────────────────────────────────────────────────────

export async function getDashboardKPIs(filters = {}) {
  const [accounts, contracts] = await Promise.all([getAllAccounts(filters), getAllContracts(filters)])
  const monthsToShow = 3

  // An account is churned only when every contract has been explicitly cancelled.
  const churnedAccounts = accounts.filter(
    (a) => a.contracts.length > 0 && a.contracts.every((c) => !!c.cancellationDate)
  )
  const activeAccounts = accounts.filter(
    (a) => a.contracts.length === 0 || a.contracts.some((c) => !c.cancellationDate)
  )
  const activeContracts = contracts.filter((c) => c.contractStatus === 'Active')
  const totalMRR = sumMRR(activeContracts)
  const totalMRRUSD = sumMRRUSD(activeContracts)

  // ACV: annualized deal value of active contracts
  const totalACV = activeContracts.reduce((s, c) => {
    const durationMonths = contractPeriod(c.startDate, c.endDate)
    return s + (Number(c.contractValue) / (durationMonths / 12))
  }, 0)
  const avgACV = activeContracts.length > 0 ? totalACV / activeContracts.length : 0

  // NRR Last Quarter
  const now = new Date()
  const currentQStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const lqStart = new Date(currentQStart.getFullYear(), currentQStart.getMonth() - 3, 1)
  const lqEnd = currentQStart
  const priorMRRLastQ = sumMRR(contracts.filter((c) => {
    const sd = new Date(c.startDate)
    const ed = new Date(c.endDate)
    const cd = c.cancellationDate ? new Date(c.cancellationDate) : null
    return sd < lqStart && ed >= lqStart && (!cd || cd >= lqStart)
  }))
  const expansionLastQ = sumMRR(contracts.filter((c) => {
    const sd = new Date(c.startDate)
    return sd >= lqStart && sd < lqEnd && c.type === 'Expansion'
  }))
  const churnedLastQ = sumMRR(contracts.filter((c) => {
    if (!c.cancellationDate) return false
    const cd = new Date(c.cancellationDate)
    return cd >= lqStart && cd < lqEnd
  }))
  const nrrLastQuarter = calcNRR(priorMRRLastQ, expansionLastQ, churnedLastQ)

  const totalBranches = accounts.reduce((s, a) => s + (a.numberOfBranches || 0), 0)
  const totalBrands = accounts.reduce((s, a) => s + (a.brands || 0), 0)
  const avgContractDuration = contracts.length > 0
    ? contracts.reduce((s, c) => s + contractPeriod(c.startDate, c.endDate), 0) / contracts.length
    : 0

  // Build last N months + one prior month for delta comparison
  const monthSlots = monthsToShow + 1
  const months = Array.from({ length: monthSlots }, (_, i) => {
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

    const newMRRUSD = sumMRRUSD(started.filter((c) => c.type === 'New'))
    const renewalMRRUSD = sumMRRUSD(started.filter((c) => c.type === 'Renewal'))
    const expansionMRRUSD = sumMRRUSD(started.filter((c) => c.type === 'Expansion'))
    const churnedMRRUSD = sumMRRUSD(cancelled)
    const totalMRRSignedUSD = newMRRUSD + renewalMRRUSD + expansionMRRUSD

    const targetStart = new Date(year, month - 1, 1)
    const priorMRR = sumMRR(
      contracts.filter((c) => {
        const sd = new Date(c.startDate)
        const ed = new Date(c.endDate)
        const cd = c.cancellationDate ? new Date(c.cancellationDate) : null
        // Active at the very start of this month (cancellations during the month still count)
        return sd < targetStart && ed >= targetStart && (!cd || cd >= targetStart)
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
      newMRRUSD,
      renewalMRRUSD,
      expansionMRRUSD,
      churnedMRRUSD,
      totalMRRSignedUSD,
      netNewMRRUSD: calcNetNewMRR(newMRRUSD, expansionMRRUSD, churnedMRRUSD),
      newContracts: started.filter((c) => c.type === 'New').length,
      churnedContracts: cancelled.length,
      contractValue: started.reduce((s, c) => s + Number(c.contractValue), 0),
      nrr: calcNRR(priorMRR, expansionMRR, churnedMRR),
      grr: calcGRR(priorMRR, churnedMRR),
    }
  })

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
      totalMRRUSD,
      totalARRUSD: totalMRRUSD * 12,
      totalContractValue: contracts.reduce((s, c) => s + Number(c.contractValue), 0),
      // FIXED: divide by active contracts only (was incorrectly dividing by all contracts)
      avgMRRPerContract: activeContracts.length > 0 ? totalMRR / activeContracts.length : 0,
      // NEW KPIs
      arpa: activeAccounts.length > 0 ? totalMRR / activeAccounts.length : 0,
      avgContractDuration: Math.round(avgContractDuration),
      mrrPerBranch: totalBranches > 0 ? totalMRR / totalBranches : 0,
      nrrLastMonth: monthlyData[1]?.nrr ?? null,
      nrrLastQuarter,
      acv: totalACV,
      avgACV,
      countriesServed: new Set(accounts.map((a) => a.country?.code).filter(Boolean)).size,
      totalBrands,
      totalBranches,
    },
    recentMonths: monthlyData.slice(0, monthsToShow),
    priorMonth: monthlyData[monthsToShow] ?? null,
  }
}

// ─── Period Aggregation Helper ────────────────────────────────────────────────

function buildPeriodRow(label, started, cancelled, prevStarted, allContracts, periodStart) {
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

  // Correct priorMRR: all contracts active at the very start of this period
  const priorMRR = (allContracts && periodStart)
    ? sumMRR(allContracts.filter((c) => {
        const sd = new Date(c.startDate)
        const ed = new Date(c.endDate)
        const cd = c.cancellationDate ? new Date(c.cancellationDate) : null
        return sd < periodStart && ed >= periodStart && (!cd || cd >= periodStart)
      }))
    : prevTotalMRR

  const newMRRUSD = sumMRRUSD(started.filter((c) => c.type === 'New'))
  const renewalMRRUSD = sumMRRUSD(started.filter((c) => c.type === 'Renewal'))
  const expansionMRRUSD = sumMRRUSD(started.filter((c) => c.type === 'Expansion'))
  const totalMRRSignedUSD = newMRRUSD + renewalMRRUSD + expansionMRRUSD

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
    newMRRUSD,
    renewalMRRUSD,
    expansionMRRUSD,
    totalMRRSignedUSD,
    netNewMRRUSD: calcNetNewMRR(newMRRUSD, expansionMRRUSD, sumMRRUSD(cancelled)),
    arrUSD: totalMRRSignedUSD * 12,
  }
}

// ─── YoY ──────────────────────────────────────────────────────────────────────

export async function getYoY(filters = {}) {
  const contracts = await getAllContracts(filters)
  const years = [...new Set(contracts.map((c) => c.startingYear))].sort()

  return years.map((year, i) => {
    const periodStart = new Date(year, 0, 1)
    const started = filterContractsByYear(contracts, year)
    const cancelled = filterCancelledByYear(contracts, year)
    const prevStarted = i > 0 ? filterContractsByYear(contracts, years[i - 1]) : null
    return buildPeriodRow(String(year), started, cancelled, prevStarted, contracts, periodStart)
  })
}

// ─── QoQ ──────────────────────────────────────────────────────────────────────

export async function getQoQ(filters = {}) {
  const contracts = await getAllContracts(filters)
  const quarters = [...new Set(contracts.map((c) => c.startingQuarterYear))].sort()

  return quarters.map((qLabel, i) => {
    const [year, q] = qLabel.split(' Q').map(Number)
    const periodStart = new Date(year, (q - 1) * 3, 1)
    const started = filterContractsByQuarter(contracts, year, q)
    const cancelled = filterCancelledByQuarter(contracts, year, q)
    let prevStarted = null
    if (i > 0) {
      const [py, pq] = quarters[i - 1].split(' Q').map(Number)
      prevStarted = filterContractsByQuarter(contracts, py, pq)
    }
    return buildPeriodRow(qLabel, started, cancelled, prevStarted, contracts, periodStart)
  })
}

// ─── MoM ──────────────────────────────────────────────────────────────────────

export async function getMoM(filters = {}) {
  const contracts = await getAllContracts(filters)
  const monthKeys = [...new Set(
    contracts.map((c) => `${c.startingYear}-${String(c.startingMonth).padStart(2, '0')}`)
  )].sort()

  return monthKeys.map((key, i) => {
    const [year, month] = key.split('-').map(Number)
    const periodStart = new Date(year, month - 1, 1)
    const started = filterContractsByMonth(contracts, year, month)
    const cancelled = filterCancelledByMonth(contracts, year, month)
    let prevStarted = null
    if (i > 0) {
      const [py, pm] = monthKeys[i - 1].split('-').map(Number)
      prevStarted = filterContractsByMonth(contracts, py, pm)
    }
    return buildPeriodRow(key, started, cancelled, prevStarted, contracts, periodStart)
  })
}

// ─── Segments ─────────────────────────────────────────────────────────────────

export async function getSegments() {
  const accounts = await getAllAccounts()
  const contracts = await getAllContracts()

  const activeContracts = contracts.filter((c) => c.contractStatus === 'Active')

  const enriched = accounts.map((a) => {
    const isActive = a.contracts.length === 0 || a.contracts.some((c) => !c.cancellationDate)
    return { ...a, isActive }
  })

  const totalMRR = sumMRR(activeContracts)

  // By Country
  const countryCodes = [...new Set(accounts.map((a) => a.country?.code).filter(Boolean))]
  const byCountry = countryCodes.map((countryCode) => {
    const accs = enriched.filter((a) => a.country?.code === countryCode)
    const ctrcts = activeContracts.filter((c) => c.account?.countryCode === countryCode)
    const mrrVal = sumMRR(ctrcts)
    const mrrValUSD = sumMRRUSD(ctrcts)
    const active = accs.filter((a) => a.isActive).length
    const churned = accs.filter((a) => !a.isActive).length
    const countryName = accs[0]?.country?.name || countryCode
    return {
      country: countryCode,
      countryName,
      totalMRR: mrrVal,
      totalMRRUSD: mrrValUSD,
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
      const mrrValUSD = sumMRRUSD(accts)
      return { id: a.id, name: a.name, mrr: mrrVal, mrrUSD: mrrValUSD, percentOfTotal: totalMRR > 0 ? mrrVal / totalMRR : 0 }
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
    const mrrValUSD = sumMRRUSD(qContracts)
    const accCount = activeAccs.length

    return {
      quarter: qLabel,
      totalMRR: mrrVal,
      totalMRRUSD: mrrValUSD,
      activeAccounts: accCount,
      avgMRRPerAccount: accCount > 0 ? mrrVal / accCount : 0,
      arr: mrrVal * 12,
      arrUSD: mrrValUSD * 12,
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
