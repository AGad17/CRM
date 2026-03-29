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

function ChurnRateBadge({ value }) {
  if (value == null) return <span className="text-gray-300">—</span>
  const p = value * 100
  const cls = p > 20 ? 'text-red-700 bg-red-50'
            : p > 10 ? 'text-amber-700 bg-amber-50'
                     : 'text-emerald-700 bg-emerald-50'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{p.toFixed(1)}%</span>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChurnPage() {
  const [tab,         setTab]         = useState('accounts')  // 'accounts' | 'trends' | 'leadsource'
  const [country,     setCountry]     = useState('')
  const [leadSources, setLeadSources] = useState([])
  const [typeFilter,  setTypeFilter]  = useState('')          // '' | 'churned' | 'expired'
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

  // ── Derived KPIs (from account list) ─────────────────────────────────────
  const totalAccounts    = accounts.length
  const churned          = accounts.filter((a) => a.status === 'Churned').length
  const expired          = accounts.filter((a) => a.status === 'Expired').length
  const totalMRRLost     = accounts.reduce((s, a) => s + (a.lastMRR || 0), 0)
  const totalARRLost     = totalMRRLost * 12
  const totalContractVal = accounts.reduce((s, a) => s + (a.contractValue || 0), 0)
  const avgMRR           = totalAccounts > 0 ? totalMRRLost / totalAccounts : 0

  // MRR lost per month (for bar chart)
  const mrrByMonth = useMemo(() => {
    const map = {}
    accounts.forEach((a) => {
      const d    = new Date(a.exitDate)
      const key  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      if (!map[key]) map[key] = { key, label, mrrLost: 0, count: 0 }
      map[key].mrrLost += a.lastMRR || 0
      map[key].count   += 1
    })
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
  }, [accounts])

  // Trends data
  const byQuarter    = trends?.byQuarter    ?? []
  const byLeadSource = trends?.byLeadSource ?? []

  // ── Column defs ───────────────────────────────────────────────────────────
  const accountCols = [
    {
      key: 'name', label: 'Account',
      render: (r) => (
        <div>
          <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
          {r.brands?.length > 0 && (
            <p className="text-xs text-gray-400 truncate max-w-[180px]">{r.brands.join(', ')}</p>
          )}
        </div>
      ),
    },
    { key: 'country',    label: 'Country',     render: (r) => r.country },
    { key: 'leadSource', label: 'Source',      render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'status',     label: 'Status',      render: (r) => <StatusBadge status={r.status} /> },
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
    { key: 'quarter',      label: 'Quarter' },
    { key: 'activeAtStart', label: 'Active at Start', render: (r) => r.activeAtStart?.length ?? 0 },
    { key: 'newLogos',     label: 'New Logos' },
    { key: 'churnedLogos', label: 'Cancelled',        render: (r) => <span className="text-red-600 font-medium">{r.churnedLogos ?? 0}</span> },
    { key: 'expiredLogos', label: 'Expired',          render: (r) => <span className="text-amber-600 font-medium">{r.expiredLogos ?? 0}</span> },
    { key: 'accumulativeChurn', label: 'Total Lost',  render: (r) => <span className="font-semibold text-gray-800">{r.accumulativeChurn ?? 0}</span> },
    { key: 'logoChurnRate',        label: 'Churn Rate',       render: (r) => <ChurnRateBadge value={r.logoChurnRate} /> },
    { key: 'accumulativeChurnRate', label: 'Accum. Rate',     render: (r) => <ChurnRateBadge value={r.accumulativeChurnRate} /> },
    { key: 'avgLifespan',  label: 'Avg Lifespan', render: (r) => r.avgLifespan ? `${r.avgLifespan.toFixed(1)} mo` : '—' },
  ]

  const sourceCols = [
    { key: 'leadSource',   label: 'Lead Source',  render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'totalAccounts', label: 'Total' },
    { key: 'active',       label: 'Active' },
    { key: 'expired',      label: 'Expired',      render: (r) => <span className="text-amber-600 font-medium">{r.expired ?? 0}</span> },
    { key: 'churned',      label: 'Churned',      render: (r) => <span className="text-red-600 font-medium">{r.churned ?? 0}</span> },
    { key: 'accumulativeChurn', label: 'Total Lost', render: (r) => <span className="font-semibold text-gray-800">{r.accumulativeChurn ?? 0}</span> },
    { key: 'churnRate',         label: 'Churn Rate',  render: (r) => <ChurnRateBadge value={r.churnRate} /> },
    { key: 'accumulativeChurnRate', label: 'Accum. Rate', render: (r) => <ChurnRateBadge value={r.accumulativeChurnRate} /> },
  ]

  const hasFilters = country || leadSources.length || typeFilter || from || to
  const isLoading  = tab === 'accounts' ? accountsLoading : trendsLoading

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

        {/* Account tab extras */}
        {tab === 'accounts' && <>
          <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Churned + Expired</option>
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

      {/* ── KPI Strip ── */}
      {tab === 'accounts' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard label="Total Lost"      value={totalAccounts}    format="integer" accent="#6b7280" />
          <KPICard label="Cancelled"       value={churned}          format="integer" accent="#ef4444" subLabel="Explicit cancellation" />
          <KPICard label="Expired"         value={expired}          format="integer" accent="#f59e0b" subLabel="Natural lapse" />
          <KPICard label="MRR Lost"        value={totalMRRLost}     format="currency" accent="#ef4444" />
          <KPICard label="ARR Lost"        value={totalARRLost}     format="currency" accent="#f97316" />
          <KPICard label="Contract Value"  value={totalContractVal} format="currency" accent="#6b7280" subLabel={`Avg ${usd(avgMRR)}/mo`} />
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
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

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-gray-100 rounded-xl" />
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
        </div>
      ) : (

        <>
          {/* ── BY ACCOUNT ── */}
          {tab === 'accounts' && (
            <div className="space-y-6">

              {/* MRR Lost per Month bar chart */}
              {mrrByMonth.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">MRR Lost — by Month</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={mrrByMonth} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<ChurnTooltip />} />
                      <Bar dataKey="mrrLost" name="MRR Lost" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Account table */}
              {accounts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-16 text-center">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="text-gray-500 font-medium">No churned or expired accounts match the selected filters.</p>
                </div>
              ) : (
                <DataTable columns={accountCols} data={accounts} exportFilename="churn-by-account.csv" pageSize={25} />
              )}
            </div>
          )}

          {/* ── BY QUARTER ── */}
          {tab === 'trends' && (
            <div className="space-y-6">
              {byQuarter.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Churn Rate Trend</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={byQuarter.filter((r) => r.logoChurnRate != null)} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<ChurnTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                      <Line type="monotone" dataKey="logoChurnRate"         name="Cancelled"      stroke="#5061F6" strokeWidth={2.5} dot={{ fill: '#5061F6', r: 4, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="expiredRate"           name="Expired"        stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="accumulativeChurnRate" name="Accumulative"   stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <DataTable columns={quarterCols} data={byQuarter} exportFilename="churn-by-quarter.csv" />
            </div>
          )}

          {/* ── BY LEAD SOURCE ── */}
          {tab === 'leadsource' && (
            <DataTable columns={sourceCols} data={byLeadSource} exportFilename="churn-by-source.csv" />
          )}
        </>
      )}
    </div>
  )
}
