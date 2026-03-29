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
  if (filters.leadSources?.length > 0) accountWhere.leadSource = { in: filters.leadSources }
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
  if (filters.leadSources?.length > 0) where.leadSource = { in: filters.leadSources }
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
  const now = new Date()
  const [accounts, contracts, openTasksCount, overdueTasksCount, atRiskRows] = await Promise.all([
    getAllAccounts(filters),
    getAllContracts(filters),
    prisma.onboardingTask.count({ where: { completed: false } }),
    prisma.onboardingTask.count({ where: { completed: false, dueDate: { lt: now } } }),
    prisma.$queryRaw`
      SELECT latest."accountId", latest.score::float, latest."accountName"
      FROM (
        SELECT DISTINCT ON (s."accountId")
          s."accountId",
          s.score::float AS score,
          a.name AS "accountName"
        FROM account_health_snapshots s
        JOIN accounts a ON a.id = s."accountId"
        ORDER BY s."accountId", s."snappedAt" DESC
      ) latest
      WHERE latest.score < 40
      ORDER BY latest.score ASC
      LIMIT 5
    `,
  ])
  const monthsToShow = 3

  // Mirror accountStatus() logic from lib/calculations.js:
  // Active   = has ≥1 contract with no cancellationDate AND endDate >= today
  // Expired  = all contracts past endDate, NONE have cancellationDate (natural lapse)
  // Churned  = no active contracts AND ≥1 has cancellationDate (explicit cancellation)
  const activeAccounts = accounts.filter(
    (a) => a.contracts.some((c) => !c.cancellationDate && now <= new Date(c.endDate))
  )
  const expiredAccounts = accounts.filter(
    (a) => a.contracts.length > 0 &&
      !a.contracts.some((c) => !c.cancellationDate && now <= new Date(c.endDate)) &&
      !a.contracts.some((c) => c.cancellationDate != null)
  )
  const churnedAccounts = accounts.filter(
    (a) => a.contracts.length > 0 &&
      !a.contracts.some((c) => !c.cancellationDate && now <= new Date(c.endDate)) &&
      a.contracts.some((c) => c.cancellationDate != null)
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
      expiredAccounts: expiredAccounts.length,
      churnedAccounts: churnedAccounts.length,
      overallChurnRate: accounts.length > 0 ? churnedAccounts.length / accounts.length : 0,
      totalContracts: contracts.length,
      activeContracts: activeContracts.length,
      totalMRR,
      totalARR: totalMRR * 12,
      totalMRRUSD,
      totalARRUSD: totalMRRUSD * 12,
      totalContractValue: contracts.reduce((s, c) => s + Number(c.contractValue), 0),
      activeContractValue: activeContracts.reduce((s, c) => s + Number(c.contractValue), 0),
      accumulativeChurn: expiredAccounts.length + churnedAccounts.length,
      accumulativeChurnRate: accounts.length > 0 ? (expiredAccounts.length + churnedAccounts.length) / accounts.length : 0,
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
      openTasksCount,
      overdueTasksCount,
    },
    recentMonths: monthlyData.slice(0, monthsToShow),
    priorMonth: monthlyData[monthsToShow] ?? null,
    atRiskAccounts: atRiskRows.map((r) => ({ ...r, score: Number(r.score) })),
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

export async function getSegments(filters = {}) {
  const accounts = await getAllAccounts(filters)
  const contracts = await getAllContracts(filters)

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

export async function getChurnAnalysis(filters = {}) {
  const contracts = await getAllContracts(filters)
  const accounts = await getAllAccounts(filters)

  const now = new Date()
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

    // Expired logos: contracts that naturally lapsed (endDate in this quarter, no cancellationDate)
    const expiredLogos = contracts.filter((c) => {
      if (c.cancellationDate) return false
      const ed = new Date(c.endDate)
      return ed >= qStart && ed < qEnd
    })

    const activeStart = activeAtStart.length
    const logoChurnRate = activeStart > 0 ? churnedLogos.length / activeStart : 0
    const expiredRate = activeStart > 0 ? expiredLogos.length / activeStart : 0

    const lifespans = churnedLogos
      .filter((c) => c.cancellationDate)
      .map((c) => contractPeriod(c.startDate, c.cancellationDate))
    const avgLifespan = lifespans.length > 0 ? lifespans.reduce((s, v) => s + v, 0) / lifespans.length : null

    return {
      quarter: qLabel,
      activeAtStart,
      newLogos: newLogos.length,
      churnedLogos: churnedLogos.length,
      expiredLogos: expiredLogos.length,
      accumulativeChurn: churnedLogos.length + expiredLogos.length,
      logoChurnRate,
      expiredRate,
      accumulativeChurnRate: activeStart > 0 ? (churnedLogos.length + expiredLogos.length) / activeStart : 0,
      avgLifespan,
    }
  })

  const sources = [...new Set(accounts.map((a) => a.leadSource))]
  const byLeadSource = sources.map((source) => {
    const accs = accounts.filter((a) => a.leadSource === source)
    const active = accs.filter((a) =>
      a.contracts.some((c) => !c.cancellationDate && now <= new Date(c.endDate))
    )
    const expired = accs.filter((a) =>
      a.contracts.length > 0 &&
      !a.contracts.some((c) => !c.cancellationDate && now <= new Date(c.endDate)) &&
      !a.contracts.some((c) => c.cancellationDate != null)
    )
    const churned = accs.filter((a) =>
      a.contracts.length > 0 &&
      !a.contracts.some((c) => !c.cancellationDate && now <= new Date(c.endDate)) &&
      a.contracts.some((c) => c.cancellationDate != null)
    )
    return {
      leadSource: source,
      totalAccounts: accs.length,
      active: active.length,
      expired: expired.length,
      churned: churned.length,
      accumulativeChurn: expired.length + churned.length,
      churnRate: accs.length > 0 ? churned.length / accs.length : 0,
      accumulativeChurnRate: accs.length > 0 ? (expired.length + churned.length) / accs.length : 0,
    }
  })

  return { byQuarter, byLeadSource }
}

// ─── Churn by Account ─────────────────────────────────────────────────────────
// Returns one row per churned/expired account with full financial details.

export async function getChurnedAccounts(filters = {}) {
  const accountWhere = {}
  if (filters.country)               accountWhere.country    = { code: filters.country }
  if (filters.leadSources?.length)   accountWhere.leadSource = { in: filters.leadSources }

  const accounts = await prisma.account.findMany({
    where: accountWhere,
    include: {
      contracts: true,
      country:   { select: { code: true, name: true, currency: true } },
      onboarding: {
        select: { churnReason: true, churnNote: true },
        where:  { phase: { in: ['Churned', 'Expired'] } },
        take: 1,
      },
    },
  })

  const now   = new Date()
  const from  = filters.from  ? new Date(filters.from)  : null
  const to    = filters.to    ? new Date(filters.to)    : null

  const rows = []

  for (const acc of accounts) {
    // Determine status
    const hasActive    = acc.contracts.some((c) => !c.cancellationDate && new Date(c.endDate) >= now)
    const hasCancelled = acc.contracts.some((c) => c.cancellationDate != null)
    const hasAny       = acc.contracts.length > 0

    let status, exitDate
    if (!hasAny || hasActive) continue   // skip active / no-contract accounts

    if (hasCancelled) {
      status   = 'Churned'
      exitDate = acc.contracts
        .filter((c) => c.cancellationDate)
        .reduce((latest, c) => {
          const d = new Date(c.cancellationDate)
          return d > latest ? d : latest
        }, new Date(0))
    } else {
      status   = 'Expired'
      exitDate = acc.contracts
        .reduce((latest, c) => {
          const d = new Date(c.endDate)
          return d > latest ? d : latest
        }, new Date(0))
    }

    // Type filter
    if (filters.type === 'churned' && status !== 'Churned') continue
    if (filters.type === 'expired' && status !== 'Expired') continue

    // Date range filter on exitDate
    if (from && exitDate < from) continue
    if (to   && exitDate > to)   continue

    // lastMRR: MRR the account was generating when last active
    const pool     = hasCancelled
      ? acc.contracts.filter((c) => !c.cancellationDate)
      : acc.contracts
    const maxEnd   = pool.length > 0
      ? Math.max(...pool.map((c) => new Date(c.endDate).getTime()))
      : null
    const lastPool = maxEnd ? pool.filter((c) => new Date(c.endDate).getTime() === maxEnd) : pool
    const lastMRR  = sumMRR(lastPool)
    const lastARR  = lastMRR * 12

    // Total contract value (all contracts for this account)
    const contractValue = acc.contracts.reduce((s, c) => s + Number(c.contractValue || 0), 0)

    // Branch / cost-centre counts
    const numberOfBranches  = acc.numberOfBranches  || null
    const centralKitchens   = acc.centralKitchens   || null
    const warehouses        = acc.warehouses        || null

    const onb = acc.onboarding?.[0] ?? null

    rows.push({
      id:               acc.id,
      name:             acc.name,
      numberOfBranches,
      centralKitchens,
      warehouses,
      country:          acc.country?.name ?? '—',
      countryCode:      acc.country?.code ?? '',
      currency:         acc.country?.currency ?? 'USD',
      leadSource:       acc.leadSource,
      status,
      exitDate:         exitDate.toISOString(),
      lastMRR,
      lastARR,
      contractValue,
      churnReason:      onb?.churnReason ?? null,
      churnNote:        onb?.churnNote   ?? null,
    })
  }

  // Sort newest exit first by default
  rows.sort((a, b) => new Date(b.exitDate) - new Date(a.exitDate))
  return rows
}

// ─── Churn Summary (cross-lens) ───────────────────────────────────────────────
// Returns churn % and cumulative churn % across 5 lenses:
// Accounts, Branches, MRR, ARR, Contract Value
// Churn % = cancelled only / total ever active
// Cumulative % = (cancelled + expired-no-active) / total ever active

export async function getChurnSummary(filters = {}) {
  const accountWhere = { contracts: { some: {} } }
  if (filters.country)             accountWhere.country    = { code: filters.country }
  if (filters.leadSources?.length) accountWhere.leadSource = { in: filters.leadSources }

  const accounts = await prisma.account.findMany({
    where: accountWhere,
    include: {
      contracts: true,
      country:   { select: { currency: true } },
    },
  })

  const now = new Date()

  // Accumulators
  let totAcc = 0, activeAcc = 0, churnedAcc = 0, expiredAcc = 0
  let totBr  = 0, activeBr  = 0, churnedBr  = 0, expiredBr  = 0
  let totCK  = 0, activeCK  = 0, churnedCK  = 0, expiredCK  = 0
  let totWH  = 0, activeWH  = 0, churnedWH  = 0, expiredWH  = 0
  let totMRR = 0, activeMRR = 0, churnedMRR = 0, expiredMRR = 0
  let totCV  = 0, activeCV  = 0, churnedCV  = 0, expiredCV  = 0

  for (const acc of accounts) {
    const hasActive    = acc.contracts.some((c) => !c.cancellationDate && new Date(c.endDate) >= now)
    const hasCancelled = acc.contracts.some((c) =>  c.cancellationDate != null)

    totAcc++

    const branches = acc.numberOfBranches || 1
    const ckCount  = acc.centralKitchens  || 0
    const whCount  = acc.warehouses       || 0
    totBr += branches
    totCK += ckCount
    totWH += whCount

    const cv = acc.contracts.reduce((s, c) => s + Number(c.contractValue || 0), 0)
    totCV += cv

    // Peak MRR = sumMRR across all contracts
    const peakMRR = sumMRR(acc.contracts)
    totMRR += peakMRR

    if (hasActive) {
      activeAcc++
      activeBr  += branches
      activeCK  += ckCount
      activeWH  += whCount
      activeMRR += sumMRR(acc.contracts.filter((c) => !c.cancellationDate && new Date(c.endDate) >= now))
      activeCV  += acc.contracts
        .filter((c) => !c.cancellationDate && new Date(c.endDate) >= now)
        .reduce((s, c) => s + Number(c.contractValue || 0), 0)
    } else if (hasCancelled) {
      // Explicitly cancelled
      churnedAcc++
      churnedBr  += branches
      churnedCK  += ckCount
      churnedWH  += whCount
      const pool  = acc.contracts.filter((c) => !c.cancellationDate)
      churnedMRR += sumMRR(pool.length ? pool : acc.contracts)
      churnedCV  += cv
    } else {
      // All contracts naturally expired, none active
      expiredAcc++
      expiredBr  += branches
      expiredCK  += ckCount
      expiredWH  += whCount
      expiredMRR += peakMRR
      expiredCV  += cv
    }
  }

  const lostAcc = churnedAcc + expiredAcc
  const lostBr  = churnedBr  + expiredBr
  const lostCK  = churnedCK  + expiredCK
  const lostWH  = churnedWH  + expiredWH
  const lostMRR = churnedMRR + expiredMRR
  const lostCV  = churnedCV  + expiredCV

  function rates(lost, churned, expired, total) {
    return {
      churnRate:      total > 0 ? churned / total : 0,   // cancelled only
      cumulativeRate: total > 0 ? lost    / total : 0,   // cancelled + expired
    }
  }

  return {
    accounts:       { total: totAcc, active: activeAcc, churned: churnedAcc, expired: expiredAcc, lost: lostAcc, ...rates(lostAcc, churnedAcc, expiredAcc, totAcc) },
    branches:       { total: totBr,  active: activeBr,  churned: churnedBr,  expired: expiredBr,  lost: lostBr,  ...rates(lostBr,  churnedBr,  expiredBr,  totBr) },
    centralKitchens:{ total: totCK,  active: activeCK,  churned: churnedCK,  expired: expiredCK,  lost: lostCK,  ...rates(lostCK,  churnedCK,  expiredCK,  totCK) },
    warehouses:     { total: totWH,  active: activeWH,  churned: churnedWH,  expired: expiredWH,  lost: lostWH,  ...rates(lostWH,  churnedWH,  expiredWH,  totWH) },
    mrr:            { total: totMRR, active: activeMRR, churned: churnedMRR, expired: expiredMRR, lost: lostMRR, ...rates(lostMRR, churnedMRR, expiredMRR, totMRR) },
    arr:            { total: totMRR * 12, active: activeMRR * 12, churned: churnedMRR * 12, expired: expiredMRR * 12, lost: lostMRR * 12, ...rates(lostMRR, churnedMRR, expiredMRR, totMRR) },
    contractValue:  { total: totCV,  active: activeCV,  churned: churnedCV,  expired: expiredCV,  lost: lostCV,  ...rates(lostCV,  churnedCV,  expiredCV,  totCV) },
  }
}

// ─── Revenue Quality ──────────────────────────────────────────────────────────

export async function getRevenueQuality(filters = {}) {
  const accounts = await getAllAccounts(filters)
  const contracts = await getAllContracts(filters)
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

// ─── Renewal Pipeline ─────────────────────────────────────────────────────────

export async function getRenewalPipeline(filters = {}) {
  const now = new Date()
  const in90 = new Date(now)
  in90.setDate(in90.getDate() + 90)

  const where = { cancellationDate: null, endDate: { gte: now, lte: in90 } }
  const accountWhere = {}
  if (filters.country) accountWhere.country = { code: filters.country }
  if (filters.leadSource) accountWhere.leadSource = filters.leadSource
  if (Object.keys(accountWhere).length > 0) where.account = accountWhere

  const raw = await prisma.contract.findMany({
    where,
    include: {
      account: {
        select: {
          id: true, name: true, leadSource: true,
          country: { select: { id: true, code: true, name: true, currency: true } },
        },
      },
    },
    orderBy: { endDate: 'asc' },
  })
  const enriched = raw.map(enrichContract)

  return enriched.map((c) => {
    const daysLeft = Math.ceil((new Date(c.endDate) - now) / (1000 * 60 * 60 * 24))
    return {
      id: c.id,
      accountId: c.accountId,
      accountName: c.account?.name,
      country: c.account?.country?.code,
      countryName: c.account?.country?.name,
      leadSource: c.account?.leadSource,
      contractValue: Number(c.contractValue),
      mrr: mrr(c),
      endDate: c.endDate,
      daysLeft,
      bucket: daysLeft <= 30 ? '30d' : daysLeft <= 60 ? '60d' : '90d',
      type: c.type,
    }
  })
}

// ─── Expired Pipeline (contracts that have naturally lapsed, no cancellation) ─

export async function getExpiredPipeline(filters = {}) {
  const now = new Date()

  const where = { cancellationDate: null, endDate: { lt: now } }
  const accountWhere = {}
  if (filters.country) accountWhere.country = { code: filters.country }
  if (filters.leadSource) accountWhere.leadSource = filters.leadSource
  if (Object.keys(accountWhere).length > 0) where.account = accountWhere

  const raw = await prisma.contract.findMany({
    where,
    include: {
      account: {
        select: {
          id: true, name: true, leadSource: true,
          country: { select: { id: true, code: true, name: true, currency: true } },
        },
      },
    },
    orderBy: { endDate: 'desc' },
  })
  const enriched = raw.map(enrichContract)

  return enriched.map((c) => {
    const daysAgo = Math.ceil((now - new Date(c.endDate)) / (1000 * 60 * 60 * 24))
    return {
      id: c.id,
      accountId: c.accountId,
      accountName: c.account?.name,
      country: c.account?.country?.code,
      countryName: c.account?.country?.name,
      leadSource: c.account?.leadSource,
      contractValue: Number(c.contractValue),
      mrr: mrr(c),
      endDate: c.endDate,
      daysAgo,
      bucket: daysAgo <= 30 ? '0-30d' : daysAgo <= 60 ? '31-60d' : daysAgo <= 90 ? '61-90d' : '90d+',
      type: c.type,
    }
  })
}

// ─── MRR Waterfall ────────────────────────────────────────────────────────────

export async function getMRRWaterfall(filters = {}) {
  const contracts = await getAllContracts(filters)

  const monthSet = new Set([
    ...contracts.map((c) => `${c.startingYear}-${String(c.startingMonth).padStart(2, '0')}`),
    ...contracts
      .filter((c) => c.cancellationDate)
      .map((c) => {
        const d = new Date(c.cancellationDate)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }),
  ])
  const monthKeys = [...monthSet].sort()

  return monthKeys.map((key) => {
    const [year, month] = key.split('-').map(Number)
    const periodStart = new Date(year, month - 1, 1)
    const started = filterContractsByMonth(contracts, year, month)
    const cancelled = filterCancelledByMonth(contracts, year, month)

    const startingMRR = sumMRR(
      contracts.filter((c) => {
        const sd = new Date(c.startDate)
        const ed = new Date(c.endDate)
        const cd = c.cancellationDate ? new Date(c.cancellationDate) : null
        return sd < periodStart && ed >= periodStart && (!cd || cd >= periodStart)
      })
    )
    const newMRR = sumMRR(started.filter((c) => c.type === 'New'))
    const expansionMRR = sumMRR(started.filter((c) => c.type === 'Expansion'))
    const renewalMRR = sumMRR(started.filter((c) => c.type === 'Renewal'))
    const churnedMRR = sumMRR(cancelled)
    const netNewMRR = newMRR + expansionMRR - churnedMRR
    return {
      period: key,
      startingMRR,
      newMRR,
      expansionMRR,
      renewalMRR,
      churnedMRR,
      netNewMRR,
      endingMRR: startingMRR + netNewMRR,
    }
  })
}

// ─── Account Health Score ─────────────────────────────────────────────────────

export async function getAccountHealth(filters = {}) {
  const trackerWhere = {}
  if (filters.country) trackerWhere.account = { country: { code: filters.country } }
  if (filters.phase) trackerWhere.phase = filters.phase

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const trackers = await prisma.onboardingTracker.findMany({
    where: trackerWhere,
    include: {
      account: {
        select: {
          id: true, name: true, leadSource: true,
          country: { select: { code: true, name: true } },
          engagementLogs: {
            select: { loggedAt: true },
            orderBy: { loggedAt: 'desc' },
          },
        },
      },
      csatRecords: { where: { score: { not: null } } },
      npsRecords: { where: { score: { not: null } } },
      tasks: true,
    },
  })

  return trackers.map((t) => {
    const avgCSAT =
      t.csatRecords.length > 0
        ? t.csatRecords.reduce((s, r) => s + r.score, 0) / t.csatRecords.length
        : null
    const avgNPS =
      t.npsRecords.length > 0
        ? t.npsRecords.reduce((s, r) => s + r.score, 0) / t.npsRecords.length
        : null
    const totalTasks = t.tasks.length
    const completedTasks = t.tasks.filter((tk) => tk.completed).length
    const taskCompletion = totalTasks > 0 ? completedTasks / totalTasks : null

    // Normalise each component 0-100
    const csatScore = avgCSAT !== null ? ((avgCSAT - 1) / 4) * 100 : null
    const npsScore = avgNPS !== null ? (avgNPS / 10) * 100 : null
    const taskScore = taskCompletion !== null ? taskCompletion * 100 : null

    // Weighted composite, ignoring missing components
    const components = [
      { w: 0.4, s: csatScore },
      { w: 0.3, s: npsScore },
      { w: 0.3, s: taskScore },
    ].filter((c) => c.s !== null)
    const totalWeight = components.reduce((s, c) => s + c.w, 0)
    const healthScore =
      components.length > 0
        ? components.reduce((s, c) => s + (c.s * c.w) / totalWeight, 0)
        : null

    // Engagement signals (informational — not included in health score)
    const engLogs = t.account?.engagementLogs ?? []
    const lastEngagedAt  = engLogs[0]?.loggedAt ?? null
    const engagements30d = engLogs.filter((l) => new Date(l.loggedAt) >= thirtyDaysAgo).length

    return {
      trackerId: t.id,
      accountId: t.account?.id,
      accountName: t.account?.name,
      country: t.account?.country?.code,
      countryName: t.account?.country?.name,
      leadSource: t.account?.leadSource,
      phase: t.phase,
      avgCSAT,
      avgNPS,
      taskCompletion,
      csatCount: t.csatRecords.length,
      npsCount: t.npsRecords.length,
      totalTasks,
      completedTasks,
      healthScore,
      lastEngagedAt,
      engagements30d,
    }
  })
}

// ─── Health Score Snapshots ───────────────────────────────────────────────────

function healthLabel(score) {
  if (score === null) return 'Unknown'
  if (score >= 70)   return 'Healthy'
  if (score >= 40)   return 'Watch'
  return 'At Risk'
}

/**
 * Take a snapshot of health scores for all accounts with trackers.
 * Safe to call repeatedly — stores one row per account per run.
 * Returns { count } of snapshots written.
 */
export async function snapshotHealthScores() {
  const rows = await getAccountHealth()
  const now  = new Date()
  let count  = 0

  for (const r of rows) {
    if (!r.accountId || r.healthScore === null) continue
    await prisma.accountHealthSnapshot.create({
      data: {
        accountId: r.accountId,
        score:     r.healthScore,
        label:     healthLabel(r.healthScore),
        csatScore: r.csatScore ?? null,
        npsScore:  r.npsScore  ?? null,
        taskPct:   r.taskCompletion !== null ? r.taskCompletion * 100 : null,
        snappedAt: now,
      },
    })
    count++
  }
  return { count }
}

/**
 * Fetch recent health score snapshots for a single account (for trend chart).
 */
export async function getAccountHealthHistory(accountId, limit = 30) {
  return prisma.accountHealthSnapshot.findMany({
    where:   { accountId: Number(accountId) },
    orderBy: { snappedAt: 'asc' },
    take:    limit,
  })
}

// ─── CS Rep Performance ───────────────────────────────────────────────────────

export async function getCSRepPerformance() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const trackers = await prisma.onboardingTracker.findMany({
    where: { accountManagerId: { not: null } },
    include: {
      accountManager: { select: { id: true, name: true, email: true, role: true } },
      account: {
        select: {
          id: true, name: true,
          country: { select: { code: true, name: true } },
          contracts: {
            where: { cancellationDate: null },
            select: { contractValue: true },
          },
          engagementLogs: {
            select: { loggedAt: true },
            orderBy: { loggedAt: 'desc' },
          },
        },
      },
      csatRecords: { where: { score: { not: null } } },
      npsRecords:  { where: { score: { not: null } } },
      tasks: true,
    },
  })

  const now = Date.now()

  // Group by accountManagerId
  const byAM = {}
  for (const t of trackers) {
    const am = t.accountManager
    if (!am) continue
    if (!byAM[am.id]) {
      byAM[am.id] = { userId: am.id, userName: am.name, userEmail: am.email, userRole: am.role, accounts: [] }
    }

    const avgCSAT = t.csatRecords.length > 0
      ? t.csatRecords.reduce((s, r) => s + r.score, 0) / t.csatRecords.length : null
    const avgNPS = t.npsRecords.length > 0
      ? t.npsRecords.reduce((s, r) => s + r.score, 0) / t.npsRecords.length : null
    const totalTasks = t.tasks.length
    const completedTasks = t.tasks.filter((tk) => tk.completed).length
    const taskCompletion = totalTasks > 0 ? completedTasks / totalTasks : null

    const csatScore = avgCSAT !== null ? ((avgCSAT - 1) / 4) * 100 : null
    const npsScore  = avgNPS  !== null ? (avgNPS / 10) * 100 : null
    const taskScore = taskCompletion !== null ? taskCompletion * 100 : null
    const components = [{ w: 0.4, s: csatScore }, { w: 0.3, s: npsScore }, { w: 0.3, s: taskScore }].filter((c) => c.s !== null)
    const totalWeight = components.reduce((s, c) => s + c.w, 0)
    const healthScore = components.length > 0
      ? components.reduce((s, c) => s + (c.s * c.w) / totalWeight, 0) : null

    const overdueTasks = t.tasks.filter((tk) => {
      if (tk.completed || !t.phaseStartedAt) return false
      const due = new Date(t.phaseStartedAt).getTime() + (tk.dueDays || 0) * 86400000
      return due < now
    }).length

    const mrr = t.account?.contracts?.reduce((s, c) => s + Number(c.contractValue || 0), 0) ?? 0

    const engLogs = t.account?.engagementLogs ?? []
    const totalEngagements = engLogs.length
    const engagements30d = engLogs.filter((l) => new Date(l.loggedAt) >= thirtyDaysAgo).length
    const lastEngagedAt = engLogs[0]?.loggedAt ?? null

    byAM[am.id].accounts.push({
      accountId: t.account?.id,
      accountName: t.account?.name,
      phase: t.phase,
      healthScore,
      avgCSAT,
      avgNPS,
      taskCompletion,
      totalTasks,
      completedTasks,
      overdueCount: overdueTasks,
      mrr,
      totalEngagements,
      engagements30d,
      lastEngagedAt,
    })
  }

  return Object.values(byAM).map((am) => {
    const accs = am.accounts
    const scored = accs.filter((a) => a.healthScore !== null)
    const avgHealthScore = scored.length > 0
      ? scored.reduce((s, a) => s + a.healthScore, 0) / scored.length : null
    const avgCSAT = accs.filter((a) => a.avgCSAT !== null).length > 0
      ? accs.filter((a) => a.avgCSAT !== null).reduce((s, a) => s + a.avgCSAT, 0) / accs.filter((a) => a.avgCSAT !== null).length : null
    const avgNPS = accs.filter((a) => a.avgNPS !== null).length > 0
      ? accs.filter((a) => a.avgNPS !== null).reduce((s, a) => s + a.avgNPS, 0) / accs.filter((a) => a.avgNPS !== null).length : null
    const totalMRR = accs.reduce((s, a) => s + a.mrr, 0)
    const totalOverdue = accs.reduce((s, a) => s + a.overdueCount, 0)

    const totalEngagements = accs.reduce((s, a) => s + (a.totalEngagements || 0), 0)
    const engagements30d   = accs.reduce((s, a) => s + (a.engagements30d   || 0), 0)

    return {
      userId: am.userId,
      userName: am.userName || am.userEmail,
      userEmail: am.userEmail,
      userRole: am.userRole,
      accountsManaged: accs.length,
      avgHealthScore,
      avgCSAT,
      avgNPS,
      accountsHealthy: scored.filter((a) => a.healthScore >= 70).length,
      accountsWatch: scored.filter((a) => a.healthScore >= 40 && a.healthScore < 70).length,
      accountsAtRisk: scored.filter((a) => a.healthScore < 40).length,
      totalOverdueTasks: totalOverdue,
      totalMRR,
      totalEngagements,
      engagements30d,
      accounts: accs,
    }
  }).sort((a, b) => (a.avgHealthScore ?? -1) - (b.avgHealthScore ?? -1))
}

// ─── Lead Source Analysis ─────────────────────────────────────────────────────

export async function getLeadSourceAnalysis(filters = {}) {
  const accounts = await getAllAccounts(filters)
  const contracts = await getAllContracts(filters)
  const activeContracts = contracts.filter((c) => c.contractStatus === 'Active')
  const totalMRR = sumMRR(activeContracts)

  const sources = [...new Set(accounts.map((a) => a.leadSource))]

  const bySource = sources.map((source) => {
    const accs = accounts.filter((a) => a.leadSource === source)
    const activeAccs = accs.filter((a) => a.contracts.some((c) => !c.cancellationDate))
    const churnedAccs = accs.filter(
      (a) => a.contracts.length > 0 && a.contracts.every((c) => !!c.cancellationDate)
    )
    const srcContracts = activeContracts.filter((c) => accs.some((a) => a.id === c.accountId))
    const srcMRR = sumMRR(srcContracts)
    const contractValue = contracts
      .filter((c) => accs.some((a) => a.id === c.accountId))
      .reduce((s, c) => s + Number(c.contractValue), 0)

    return {
      leadSource: source,
      totalAccounts: accs.length,
      activeAccounts: activeAccs.length,
      churnedAccounts: churnedAccs.length,
      churnRate: accs.length > 0 ? churnedAccs.length / accs.length : 0,
      mrr: srcMRR,
      avgMRRPerAccount: activeAccs.length > 0 ? srcMRR / activeAccs.length : 0,
      contractValue,
      activeContracts: srcContracts.length,
      percentOfMRR: totalMRR > 0 ? srcMRR / totalMRR : 0,
      percentOfAccounts: accounts.length > 0 ? accs.length / accounts.length : 0,
    }
  }).sort((a, b) => b.mrr - a.mrr)

  // Quarterly new-account trend per lead source
  const quarters = [...new Set(contracts.map((c) => c.startingQuarterYear))].sort()
  const trend = quarters.map((q) => {
    const qNew = contracts.filter((c) => c.startingQuarterYear === q && c.type === 'New')
    const row = { quarter: q }
    sources.forEach((src) => {
      const srcAccIds = accounts.filter((a) => a.leadSource === src).map((a) => a.id)
      row[src] = qNew.filter((c) => srcAccIds.includes(c.accountId)).length
    })
    return row
  })

  return { bySource, trend, sources }
}

// ─── Sales Win / Loss ─────────────────────────────────────────────────────────

export async function getWinLoss(filters = {}) {
  const where = {}
  if (filters.country) where.countryCode = filters.country
  if (filters.leadSources?.length > 0) where.channel = { in: filters.leadSources }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      stage: true,
      channel: true,
      countryCode: true,
      estimatedValue: true,
      createdAt: true,
      convertedAt: true,
      lostReason: true,
    },
  })

  const wonLeads = leads.filter((l) => l.stage === 'ClosedWon')
  const lostLeads = leads.filter((l) => l.stage === 'ClosedLost')
  const totalClosed = wonLeads.length + lostLeads.length

  const quarterOf = (d) => {
    const dt = new Date(d)
    return `${dt.getFullYear()} Q${Math.floor(dt.getMonth() / 3) + 1}`
  }

  const channels = [...new Set(leads.map((l) => l.channel))]
  const byChannel = channels.map((channel) => {
    const all = leads.filter((l) => l.channel === channel)
    const won = all.filter((l) => l.stage === 'ClosedWon')
    const lost = all.filter((l) => l.stage === 'ClosedLost')
    const closed = won.length + lost.length
    const vels = won
      .filter((l) => l.convertedAt)
      .map((l) => Math.ceil((new Date(l.convertedAt) - new Date(l.createdAt)) / 86400000))
    const avgVelocity = vels.length > 0 ? vels.reduce((s, v) => s + v, 0) / vels.length : null
    const dealSizes = won.filter((l) => l.estimatedValue).map((l) => Number(l.estimatedValue))
    const avgDealSize =
      dealSizes.length > 0 ? dealSizes.reduce((s, v) => s + v, 0) / dealSizes.length : null
    return { channel, total: all.length, won: won.length, lost: lost.length,
      winRate: closed > 0 ? won.length / closed : 0, avgVelocity, avgDealSize }
  }).sort((a, b) => b.total - a.total)

  const allQuarters = [...new Set(leads.map((l) => quarterOf(l.createdAt)))].sort()
  const byQuarter = allQuarters.map((q) => {
    const qLeads = leads.filter((l) => quarterOf(l.createdAt) === q)
    const qWon = qLeads.filter((l) => l.stage === 'ClosedWon')
    const qLost = qLeads.filter((l) => l.stage === 'ClosedLost')
    const closed = qWon.length + qLost.length
    return { quarter: q, total: qLeads.length, won: qWon.length, lost: qLost.length,
      winRate: closed > 0 ? qWon.length / closed : 0 }
  })

  const overallWinRate = totalClosed > 0 ? wonLeads.length / totalClosed : 0
  const allVels = wonLeads
    .filter((l) => l.convertedAt)
    .map((l) => Math.ceil((new Date(l.convertedAt) - new Date(l.createdAt)) / 86400000))
  const avgVelocity = allVels.length > 0 ? allVels.reduce((s, v) => s + v, 0) / allVels.length : null

  // Lost reason breakdown
  const lostReasons = {}
  lostLeads.forEach((l) => {
    const reason = l.lostReason || 'Unknown'
    lostReasons[reason] = (lostReasons[reason] || 0) + 1
  })
  const byLostReason = Object.entries(lostReasons)
    .map(([reason, count]) => ({ reason, count, pct: lostLeads.length > 0 ? count / lostLeads.length : 0 }))
    .sort((a, b) => b.count - a.count)

  return {
    summary: { totalLeads: leads.length, totalWon: wonLeads.length, totalLost: lostLeads.length,
      overallWinRate, avgVelocity },
    byChannel,
    byQuarter,
    byLostReason,
  }
}

// ─── Net Revenue Retention Breakdown ─────────────────────────────────────────

export async function getNRRBreakdown(filters = {}) {
  const contracts = await getAllContracts(filters)
  const quarters = [...new Set(contracts.map((c) => c.startingQuarterYear))].sort()

  return quarters.map((qLabel) => {
    const [year, q] = qLabel.split(' Q').map(Number)
    const qStart = new Date(year, (q - 1) * 3, 1)

    const startingMRR = sumMRR(
      contracts.filter((c) => {
        const sd = new Date(c.startDate)
        const ed = new Date(c.endDate)
        const cd = c.cancellationDate ? new Date(c.cancellationDate) : null
        return sd < qStart && ed >= qStart && (!cd || cd >= qStart)
      })
    )
    const qContracts = filterContractsByQuarter(contracts, year, q)
    const expansionMRR = sumMRR(qContracts.filter((c) => c.type === 'Expansion'))
    const churnedMRR = sumMRR(filterCancelledByQuarter(contracts, year, q))
    const retainedMRR = startingMRR - churnedMRR
    const endingMRR = retainedMRR + expansionMRR

    return {
      quarter: qLabel,
      startingMRR,
      retainedMRR,
      expansionMRR,
      churnedMRR,
      endingMRR,
      netNewMRR: endingMRR - startingMRR,
      nrr: startingMRR > 0 ? endingMRR / startingMRR : null,
      grr: startingMRR > 0 ? retainedMRR / startingMRR : null,
    }
  })
}

// ─── MRR Cohort Retention ─────────────────────────────────────────────────────

export async function getCohorts(filters = {}) {
  const contracts = await getAllContracts(filters)

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
