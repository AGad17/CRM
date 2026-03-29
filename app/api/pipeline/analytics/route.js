import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'

export async function GET(req) {
  const { error } = await requirePermission('pipeline', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const where = { archived: false }
  const countriesRaw = searchParams.get('countries')
  const countries = countriesRaw ? countriesRaw.split(',').filter(Boolean) : []
  if (countries.length === 1)      where.countryCode = countries[0]
  else if (countries.length > 1)   where.countryCode = { in: countries }
  const leadSources = searchParams.get('leadSources')?.split(',').filter(Boolean) || []
  if (leadSources.length > 0) where.channel = { in: leadSources }

  // Date range filter (applies to createdAt)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to)   where.createdAt.lte = new Date(to + 'T23:59:59.999Z')
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      stage: true,
      channel: true,
      countryCode: true,
      estimatedValue: true,
      convertedAt: true,
      createdAt: true,
      updatedAt: true,
      expectedCloseDate: true,
      lostReasonCategory: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
  })

  return NextResponse.json(computeAnalytics(leads))
}

function toNum(v) { return v ? Number(v) : 0 }

function fmtMonth(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
}

function computeAnalytics(leads) {
  const now = new Date()

  // ── Summary ──────────────────────────────────────────────────────────────
  const won       = leads.filter(l => l.stage === 'ClosedWon')
  const lost      = leads.filter(l => l.stage === 'ClosedLost')
  const qualified = leads.filter(l => l.stage === 'Qualified')
  const active    = leads.filter(l => l.stage === 'Lead')

  const totalClosed = won.length + lost.length
  const winRate     = totalClosed > 0 ? won.length / totalClosed : 0

  const wonDates = won.filter(l => l.convertedAt && l.createdAt)
  const avgDaysToClose = wonDates.length
    ? Math.round(
        wonDates.reduce((s, l) =>
          s + Math.floor((new Date(l.convertedAt) - new Date(l.createdAt)) / 86400000), 0
        ) / wonDates.length
      )
    : 0

  const thisMonthKey  = now.getFullYear() * 100 + now.getMonth()
  const wonThisMonth  = won.filter(l => {
    if (!l.convertedAt) return false
    const d = new Date(l.convertedAt)
    return d.getFullYear() * 100 + d.getMonth() === thisMonthKey
  }).length

  const pipelineValue = qualified.reduce((s, l) => s + toNum(l.estimatedValue), 0)

  // Use actual win rates per channel for weighted forecast
  const channelWinRates = {}
  const allChannels = [...new Set(leads.map(l => l.channel).filter(Boolean))]
  for (const ch of allChannels) {
    const chWon  = leads.filter(l => l.channel === ch && l.stage === 'ClosedWon').length
    const chLost = leads.filter(l => l.channel === ch && l.stage === 'ClosedLost').length
    const total  = chWon + chLost
    channelWinRates[ch] = total > 0 ? chWon / total : 0.3 // fallback 30% if no history
  }
  const weightedForecast =
    qualified.reduce((s, l) => s + toNum(l.estimatedValue) * (channelWinRates[l.channel] ?? 0.3), 0) +
    active.reduce((s, l)    => s + toNum(l.estimatedValue) * (channelWinRates[l.channel] ?? 0.3) * 0.3, 0)

  const summary = {
    total: leads.length,
    winRate,
    avgDaysToClose,
    pipelineValue,
    wonThisMonth,
    weightedForecast,
  }

  // ── By Stage ─────────────────────────────────────────────────────────────
  const STAGE_ORDER = ['Lead', 'Qualified', 'ClosedWon', 'ClosedLost']
  const STAGE_LABELS = {
    Lead: 'Lead', Qualified: 'Qualified',
    ClosedWon: 'Closed Won', ClosedLost: 'Closed Lost',
  }
  const byStage = STAGE_ORDER.map(stage => {
    const group = leads.filter(l => l.stage === stage)
    return {
      stage,
      label: STAGE_LABELS[stage] || stage,
      count: group.length,
      value: group.reduce((s, l) => s + toNum(l.estimatedValue), 0),
    }
  })

  // ── By Channel ───────────────────────────────────────────────────────────
  const channelMap = {}
  for (const l of leads) {
    const key = l.channel || 'Unknown'
    if (!channelMap[key]) channelMap[key] = { channel: key, total: 0, won: 0, lost: 0, valueSum: 0 }
    channelMap[key].total++
    if (l.stage === 'ClosedWon')  channelMap[key].won++
    if (l.stage === 'ClosedLost') channelMap[key].lost++
    channelMap[key].valueSum += toNum(l.estimatedValue)
  }
  const byChannel = Object.values(channelMap)
    .sort((a, b) => b.total - a.total)
    .map(c => ({
      ...c,
      winRate:  (c.won + c.lost) > 0 ? c.won / (c.won + c.lost) : 0,
      avgValue: c.total > 0 ? c.valueSum / c.total : 0,
    }))

  // ── By Country ───────────────────────────────────────────────────────────
  const countryMap = {}
  for (const l of leads) {
    const key = l.countryCode || 'Unknown'
    if (!countryMap[key]) countryMap[key] = { country: key, total: 0, won: 0, pipelineValue: 0 }
    countryMap[key].total++
    if (l.stage === 'ClosedWon') countryMap[key].won++
    if (l.stage === 'Qualified')  countryMap[key].pipelineValue += toNum(l.estimatedValue)
  }
  const byCountry = Object.values(countryMap)
    .sort((a, b) => b.total - a.total)
    .map(c => ({
      ...c,
      winRate: c.total > 0 ? c.won / c.total : 0,
    }))

  // ── By Owner ─────────────────────────────────────────────────────────────
  const ownerMap = {}
  for (const l of leads) {
    const key = l.owner?.name || l.ownerId || 'Unassigned'
    if (!ownerMap[key]) ownerMap[key] = { ownerName: key, total: 0, won: 0, lost: 0, inPipeline: 0 }
    ownerMap[key].total++
    if (l.stage === 'ClosedWon')  ownerMap[key].won++
    if (l.stage === 'ClosedLost') ownerMap[key].lost++
    if (l.stage === 'Lead' || l.stage === 'Qualified') ownerMap[key].inPipeline++
  }
  const byOwner = Object.values(ownerMap)
    .sort((a, b) => b.total - a.total)
    .map(o => ({
      ...o,
      winRate: (o.won + o.lost) > 0 ? o.won / (o.won + o.lost) : 0,
    }))

  // ── Monthly Trend (last 12 months, zero-padded) ───────────────────────────
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      month:   fmtMonth(d),
      label:   d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      created: 0,
      won:     0,
      lost:    0,
    })
  }
  const monthIndex = Object.fromEntries(months.map((m, i) => [m.month, i]))

  for (const l of leads) {
    const ck = fmtMonth(l.createdAt)
    if (monthIndex[ck] !== undefined) months[monthIndex[ck]].created++

    if (l.stage === 'ClosedWon' && l.convertedAt) {
      const wk = fmtMonth(l.convertedAt)
      if (monthIndex[wk] !== undefined) months[monthIndex[wk]].won++
    }
    if (l.stage === 'ClosedLost') {
      const lk = fmtMonth(l.updatedAt)
      if (monthIndex[lk] !== undefined) months[monthIndex[lk]].lost++
    }
  }

  // ── Lost by Reason ───────────────────────────────────────────────────────────
  const lostReasonMap = {}
  for (const l of lost) {
    const key = l.lostReasonCategory || 'Not specified'
    lostReasonMap[key] = (lostReasonMap[key] || 0) + 1
  }
  const byLostReason = Object.entries(lostReasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  return { summary, byStage, byChannel, byCountry, byOwner, monthlyTrend: months, byLostReason }
}
