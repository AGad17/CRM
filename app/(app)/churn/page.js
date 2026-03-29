'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { LeadSourceFilter } from '@/components/ui/LeadSourceFilter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v)   { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }
function usd(v)   { return v != null ? `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—' }
function num(v)   { return v != null ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—' }
function local(v, cur) {
  if (v == null) return '—'
  return `${cur ?? ''} ${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.trim()
}

const CHURN_REASON_LABELS = {
  PriceTooHigh:        'Price Too High',
  LowAdoption:         'Low Adoption',
  SwitchedCompetitor:  'Switched to Competitor',
  BusinessClosed:      'Business Closed',
  ContractNotRenewed:  'Contract Not Renewed',
  PoorSupport:         'Poor Support',
  MissingFeatures:     'Missing Features',
  TechnicalIssues:     'Technical Issues',
  BudgetCut:           'Budget Cut',
  Other:               'Other',
}

function ChurnRateBadge({ value, size = 'sm' }) {
  if (value == null) return <span className="text-gray-300">—</span>
  const p = value * 100
  const cls = p > 20 ? 'text-red-700 bg-red-50 border border-red-200'
            : p > 10 ? 'text-amber-700 bg-amber-50 border border-amber-200'
                     : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
  return (
    <span className={`inline-block rounded-full font-bold ${size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'} ${cls}`}>
      {p.toFixed(1)}%
    </span>
  )
}

function StatusBadge({ status }) {
  const cls = status === 'Churned'
    ? 'bg-red-50 text-red-700 border border-red-200'
    : 'bg-amber-50 text-amber-700 border border-amber-200'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{status}</span>
}

function ChurnTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value < 2 ? `${(p.value * 100).toFixed(1)}%` : usd(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Overview: cross-lens summary table ───────────────────────────────────────

function LensSummaryTable({ s }) {
  if (!s) return <div className="animate-pulse h-48 bg-gray-100 rounded-2xl" />

  const rows = [
    {
      lens:    '🏢 Accounts',
      unit:    'accounts',
      total:   num(s.accounts.total),
      active:  num(s.accounts.active),
      cancelled: num(s.accounts.churned),
      expired: num(s.accounts.expired),
      lost:    num(s.accounts.lost),
      churnRate:      s.accounts.churnRate,
      cumulativeRate: s.accounts.cumulativeRate,
    },
    {
      lens:    '🏬 Branches',
      unit:    'branches',
      total:   num(s.branches.total),
      active:  num(s.branches.active),
      cancelled: num(s.branches.churned),
      expired: num(s.branches.expired),
      lost:    num(s.branches.lost),
      churnRate:      s.branches.churnRate,
      cumulativeRate: s.branches.cumulativeRate,
    },
    {
      lens:    '💵 MRR',
      unit:    'usd',
      total:   usd(s.mrr.total),
      active:  usd(s.mrr.active),
      cancelled: usd(s.mrr.churned),
      expired: usd(s.mrr.expired),
      lost:    usd(s.mrr.lost),
      churnRate:      s.mrr.churnRate,
      cumulativeRate: s.mrr.cumulativeRate,
    },
    {
      lens:    '📅 ARR',
      unit:    'usd',
      total:   usd(s.arr.total),
      active:  usd(s.arr.active),
      cancelled: usd(s.arr.churned),
      expired: usd(s.arr.expired),
      lost:    usd(s.arr.lost),
      churnRate:      s.arr.churnRate,
      cumulativeRate: s.arr.cumulativeRate,
    },
    {
      lens:    '📄 Contract Value',
      unit:    'usd',
      total:   usd(s.contractValue.total),
      active:  usd(s.contractValue.active),
      cancelled: usd(s.contractValue.churned),
      expired: usd(s.contractValue.expired),
      lost:    usd(s.contractValue.lost),
      churnRate:      s.contractValue.churnRate,
      cumulativeRate: s.contractValue.cumulativeRate,
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Churn Summary — All Time</p>
        <p className="text-xs text-gray-400 mt-0.5">
          <span className="font-semibold text-red-600">Churn %</span> = cancelled only ÷ total ever active &nbsp;·&nbsp;
          <span className="font-semibold text-gray-700">Cumulative %</span> = (cancelled + naturally expired) ÷ total ever active
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="px-5 py-3 text-left">Lens</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Active</th>
              <th className="px-4 py-3 text-right text-red-400">Cancelled</th>
              <th className="px-4 py-3 text-right text-amber-500">Expired</th>
              <th className="px-4 py-3 text-right">Total Lost</th>
              <th className="px-4 py-3 text-center text-red-500">Churn %</th>
              <th className="px-4 py-3 text-center text-gray-600">Cumulative %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.lens} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="px-5 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{r.lens}</td>
                <td className="px-4 py-3.5 text-right text-gray-600 font-medium">{r.total}</td>
                <td className="px-4 py-3.5 text-right text-emerald-700 font-semibold">{r.active}</td>
                <td className="px-4 py-3.5 text-right text-red-600 font-semibold">{r.cancelled}</td>
                <td className="px-4 py-3.5 text-right text-amber-600 font-semibold">{r.expired}</td>
                <td className="px-4 py-3.5 text-right font-bold text-gray-800">{r.lost}</td>
                <td className="px-4 py-3.5 text-center">
                  <ChurnRateBadge value={r.churnRate} size="sm" />
                </td>
                <td className="px-4 py-3.5 text-center">
                  <ChurnRateBadge value={r.cumulativeRate} size="lg" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChurnPage() {
  const [tab,         setTab]         = useState('overview')
  const [country,     setCountry]     = useState('')
  const [leadSources, setLeadSources] = useState([])
  const [typeFilter,  setTypeFilter]  = useState('')
  const [from,        setFrom]        = useState('')
  const [to,          setTo]          = useState('')

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const sharedParams = useMemo(() => {
    const p = new URLSearchParams()
    if (country) p.set('country', country)
    if (leadSources.length) p.set('leadSources', leadSources.join(','))
    return p
  }, [country, leadSources])

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['churn-summary', country, leadSources],
    queryFn: () => fetch(`/api/analytics/churn-summary?${sharedParams}`).then((r) => r.json()),
  })

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['churn-trends', country, leadSources],
    queryFn: () => fetch(`/api/analytics/churn?${sharedParams}`).then((r) => r.json()),
  })

  const accountParams = useMemo(() => {
    const p = new URLSearchParams(sharedParams)
    if (typeFilter) p.set('type', typeFilter)
    if (from)       p.set('from', from)
    if (to)         p.set('to', to)
    return p
  }, [sharedParams, typeFilter, from, to])

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['churn-accounts', country, leadSources, typeFilter, from, to],
    queryFn: () => fetch(`/api/analytics/churn-accounts?${accountParams}`).then((r) => r.json()),
  })

  // ── Derived ───────────────────────────────────────────────────────────────
  const mrrByMonth = useMemo(() => {
    const map = {}
    accounts.forEach((a) => {
      const d     = new Date(a.exitDate)
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      if (!map[key]) map[key] = { key, label, mrrLost: 0, count: 0 }
      map[key].mrrLost += a.lastMRR || 0
      map[key].count   += 1
    })
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
  }, [accounts])

  const byQuarter    = trends?.byQuarter    ?? []
  const byLeadSource = trends?.byLeadSource ?? []

  // ── Column defs ───────────────────────────────────────────────────────────
  const accountCols = [
    {
      key: 'name', label: 'Account',
      render: (r) => <p className="font-semibold text-gray-900 text-sm">{r.name}</p>,
    },
    {
      key: 'numberOfBranches', label: 'Branches',
      render: (r) => r.numberOfBranches
        ? <span className="font-semibold text-gray-700">{r.numberOfBranches}</span>
        : <span className="text-gray-300">—</span>,
      getValue: (r) => r.numberOfBranches ?? 0,
    },
    { key: 'country',    label: 'Country',  render: (r) => r.country },
    { key: 'leadSource', label: 'Source',   render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'status',     label: 'Status',   render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'exitDate', label: 'Exit Date',
      render: (r) => new Date(r.exitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      getValue: (r) => r.exitDate,
    },
    {
      key: 'lastMRR', label: 'MRR Lost',
      render: (r) => (
        <div>
          <p className="font-semibold text-red-600">{local(r.lastMRR, r.currency)}</p>
          <p className="text-[10px] text-gray-400">{usd(r.lastMRR)} USD</p>
        </div>
      ),
      getValue: (r) => Number(r.lastMRR || 0),
    },
    {
      key: 'lastARR', label: 'ARR Lost',
      render: (r) => (
        <div>
          <p className="font-semibold text-gray-700">{local(r.lastARR, r.currency)}</p>
          <p className="text-[10px] text-gray-400">{usd(r.lastARR)} USD</p>
        </div>
      ),
      getValue: (r) => Number(r.lastARR || 0),
    },
    {
      key: 'contractValue', label: 'Contract Value',
      render: (r) => (
        <div>
          <p className="font-semibold text-gray-700">{local(r.contractValue, r.currency)}</p>
          <p className="text-[10px] text-gray-400">{usd(r.contractValue)} USD</p>
        </div>
      ),
      getValue: (r) => Number(r.contractValue || 0),
    },
    {
      key: 'churnReason', label: 'Reason',
      render: (r) => r.churnReason
        ? <span className="text-xs text-gray-600">{CHURN_REASON_LABELS[r.churnReason] ?? r.churnReason}</span>
        : <span className="text-gray-300 text-xs">—</span>,
    },
  ]

  const quarterCols = [
    { key: 'quarter',           label: 'Quarter' },
    { key: 'activeAtStart',     label: 'Active at Start', render: (r) => r.activeAtStart?.length ?? 0 },
    { key: 'newLogos',          label: 'New Logos' },
    { key: 'churnedLogos',      label: 'Cancelled',  render: (r) => <span className="text-red-600 font-medium">{r.churnedLogos ?? 0}</span> },
    { key: 'expiredLogos',      label: 'Expired',    render: (r) => <span className="text-amber-600 font-medium">{r.expiredLogos ?? 0}</span> },
    { key: 'accumulativeChurn', label: 'Total Lost', render: (r) => <span className="font-semibold text-gray-800">{r.accumulativeChurn ?? 0}</span> },
    { key: 'logoChurnRate',         label: 'Churn %',      render: (r) => <ChurnRateBadge value={r.logoChurnRate} /> },
    { key: 'accumulativeChurnRate', label: 'Cumulative %', render: (r) => <ChurnRateBadge value={r.accumulativeChurnRate} size="lg" /> },
    { key: 'avgLifespan',       label: 'Avg Lifespan', render: (r) => r.avgLifespan ? `${r.avgLifespan.toFixed(1)} mo` : '—' },
  ]

  const sourceCols = [
    { key: 'leadSource',   label: 'Lead Source',  render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'totalAccounts', label: 'Total' },
    { key: 'active',       label: 'Active' },
    { key: 'expired',      label: 'Expired',      render: (r) => <span className="text-amber-600 font-medium">{r.expired ?? 0}</span> },
    { key: 'churned',      label: 'Cancelled',    render: (r) => <span className="text-red-600 font-medium">{r.churned ?? 0}</span> },
    { key: 'accumulativeChurn', label: 'Total Lost', render: (r) => <span className="font-semibold text-gray-800">{r.accumulativeChurn ?? 0}</span> },
    { key: 'churnRate',         label: 'Churn %',      render: (r) => <ChurnRateBadge value={r.churnRate} /> },
    { key: 'accumulativeChurnRate', label: 'Cumulative %', render: (r) => <ChurnRateBadge value={r.accumulativeChurnRate} size="lg" /> },
  ]

  const hasFilters = country || leadSources.length || typeFilter || from || to

  return (
    <div className="space-y-6">

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
        <LeadSourceFilter value={leadSources} onChange={setLeadSources} />
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>

        {tab === 'accounts' && <>
          <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Cancelled + Expired</option>
            <option value="churned">Cancelled only</option>
            <option value="expired">Expired only</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            title="Exit date from" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            title="Exit date to" />
        </>}

        {hasFilters && (
          <button onClick={() => { setCountry(''); setLeadSources([]); setTypeFilter(''); setFrom(''); setTo('') }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'overview',   label: '📊 Overview' },
          { key: 'accounts',   label: '👤 By Account' },
          { key: 'trends',     label: '📈 By Quarter' },
          { key: 'leadsource', label: '🔗 By Source' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {summaryLoading
            ? <div className="animate-pulse h-48 bg-gray-100 rounded-2xl" />
            : <LensSummaryTable s={summary} />
          }

          {/* Visual: churn % by lens */}
          {summary && (() => {
            const chartData = [
              { lens: 'Accounts',       churnRate: summary.accounts.churnRate * 100,      cumRate: summary.accounts.cumulativeRate * 100 },
              { lens: 'Branches',       churnRate: summary.branches.churnRate * 100,      cumRate: summary.branches.cumulativeRate * 100 },
              { lens: 'MRR',            churnRate: summary.mrr.churnRate * 100,           cumRate: summary.mrr.cumulativeRate * 100 },
              { lens: 'ARR',            churnRate: summary.arr.churnRate * 100,           cumRate: summary.arr.cumulativeRate * 100 },
              { lens: 'Contract Value', churnRate: summary.contractValue.churnRate * 100, cumRate: summary.contractValue.cumulativeRate * 100 },
            ]
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Churn % vs Cumulative % by Lens</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="lens" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="churnRate" name="Churn % (cancelled)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="cumRate"   name="Cumulative % (cancelled + expired)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── BY ACCOUNT ── */}
      {tab === 'accounts' && (
        <div className="space-y-6">
          {/* KPI strip */}
          {!accountsLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICard label="Total Lost"     value={accounts.length}                                                          format="integer"  accent="#6b7280" />
              <KPICard label="Cancelled"      value={accounts.filter((a) => a.status === 'Churned').length}                   format="integer"  accent="#ef4444" subLabel="Explicit" />
              <KPICard label="Expired"        value={accounts.filter((a) => a.status === 'Expired').length}                   format="integer"  accent="#f59e0b" subLabel="Natural lapse" />
              <KPICard label="MRR Lost"       value={accounts.reduce((s, a) => s + (a.lastMRR || 0), 0)}                     format="currency" accent="#ef4444" />
              <KPICard label="ARR Lost"       value={accounts.reduce((s, a) => s + (a.lastMRR || 0), 0) * 12}                format="currency" accent="#f97316" />
              <KPICard label="Contract Value" value={accounts.reduce((s, a) => s + (a.contractValue || 0), 0)}               format="currency" accent="#6b7280" />
            </div>
          )}

          {/* MRR lost by month */}
          {mrrByMonth.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">MRR Lost — by Month</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mrrByMonth} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => usd(v)} />
                  <Bar dataKey="mrrLost" name="MRR Lost" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {accountsLoading
            ? <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
            : accounts.length === 0
              ? <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-16 text-center">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="text-gray-500 font-medium">No churned or expired accounts match the selected filters.</p>
                </div>
              : <DataTable columns={accountCols} data={accounts} exportFilename="churn-by-account.csv" pageSize={25} />
          }
        </div>
      )}

      {/* ── BY QUARTER ── */}
      {tab === 'trends' && (
        <div className="space-y-6">
          {trendsLoading
            ? <div className="animate-pulse h-56 bg-gray-100 rounded-2xl" />
            : byQuarter.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Churn Rate Trend</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={byQuarter.filter((r) => r.logoChurnRate != null)} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<ChurnTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                    <Line type="monotone" dataKey="logoChurnRate"         name="Churn % (cancelled)"      stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 4, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="expiredRate"           name="Expired %"                stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="accumulativeChurnRate" name="Cumulative % (cancelled + expired)" stroke="#6b7280" strokeWidth={2} dot={{ fill: '#6b7280', r: 3, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          }
          <DataTable columns={quarterCols} data={byQuarter} exportFilename="churn-by-quarter.csv" />
        </div>
      )}

      {/* ── BY LEAD SOURCE ── */}
      {tab === 'leadsource' && (
        <DataTable columns={sourceCols} data={byLeadSource} exportFilename="churn-by-source.csv" />
      )}
    </div>
  )
}
