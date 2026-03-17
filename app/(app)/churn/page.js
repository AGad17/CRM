'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { LeadSourceFilter } from '@/components/ui/LeadSourceFilter'


function pct(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—' }

function ChurnTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {(p.value * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

function ChurnRateBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>
  const pct_ = value * 100
  if (pct_ > 20) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-red-700 bg-red-50">{pct_.toFixed(1)}%</span>
  if (pct_ > 10) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-amber-700 bg-amber-50">{pct_.toFixed(1)}%</span>
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50">{pct_.toFixed(1)}%</span>
}

export default function ChurnPage() {
  const [country, setCountry] = useState('')
  const [leadSources, setLeadSources] = useState([])

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['churn', country, leadSources],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSources.length > 0) p.set('leadSources', leadSources.join(','))
      return fetch(`/api/analytics/churn?${p}`).then((r) => r.json())
    },
  })

  const byQuarter = data?.byQuarter || []
  const byLeadSource = data?.byLeadSource || []

  // Derived KPIs
  const totalChurnedLogos = byQuarter.reduce((s, r) => s + (r.churnedLogos || 0), 0)
  const totalExpiredLogos = byQuarter.reduce((s, r) => s + (r.expiredLogos || 0), 0)
  const totalAccumulativeChurn = totalChurnedLogos + totalExpiredLogos
  const totalNewLogos = byQuarter.reduce((s, r) => s + (r.newLogos || 0), 0)
  const avgChurnRate = byQuarter.length > 0
    ? byQuarter.reduce((s, r) => s + (r.logoChurnRate || 0), 0) / byQuarter.length
    : 0
  const avgAccumulativeChurnRate = byQuarter.length > 0
    ? byQuarter.reduce((s, r) => s + (r.accumulativeChurnRate || 0), 0) / byQuarter.length
    : 0
  const lifespans = byQuarter.filter((r) => r.avgLifespan).map((r) => r.avgLifespan)
  const avgLifespan = lifespans.length > 0 ? lifespans.reduce((a, b) => a + b, 0) / lifespans.length : null

  const quarterCols = [
    { key: 'quarter', label: 'Quarter' },
    { key: 'activeAtStart', label: 'Active at Start', render: (r) => r.activeAtStart?.length ?? 0 },
    { key: 'newLogos', label: 'New Logos' },
    { key: 'churnedLogos', label: 'Cancelled' },
    { key: 'expiredLogos', label: 'Expired (Natural)',
      render: (r) => <span className="text-amber-700 font-medium">{r.expiredLogos ?? 0}</span> },
    { key: 'accumulativeChurn', label: 'Accumulative Loss',
      render: (r) => <span className="font-semibold text-gray-800">{r.accumulativeChurn ?? 0}</span> },
    {
      key: 'logoChurnRate', label: 'Churn Rate',
      render: (r) => <ChurnRateBadge value={r.logoChurnRate} />,
    },
    {
      key: 'accumulativeChurnRate', label: 'Accumulative Rate',
      render: (r) => <ChurnRateBadge value={r.accumulativeChurnRate} />,
    },
    { key: 'avgLifespan', label: 'Avg Lifespan', render: (r) => r.avgLifespan ? `${r.avgLifespan.toFixed(1)} mo` : '—' },
  ]

  const sourceCols = [
    { key: 'leadSource', label: 'Lead Source', render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'totalAccounts', label: 'Total' },
    { key: 'active', label: 'Active' },
    { key: 'expired', label: 'Expired', render: (r) => <span className="text-amber-600 font-medium">{r.expired ?? 0}</span> },
    { key: 'churned', label: 'Churned', render: (r) => <span className="text-red-600 font-medium">{r.churned ?? 0}</span> },
    { key: 'accumulativeChurn', label: 'Accumulative Loss',
      render: (r) => <span className="font-semibold text-gray-800">{r.accumulativeChurn ?? 0}</span> },
    {
      key: 'churnRate', label: 'Churn Rate',
      render: (r) => <ChurnRateBadge value={r.churnRate} />,
    },
    {
      key: 'accumulativeChurnRate', label: 'Accumulative Rate',
      render: (r) => <ChurnRateBadge value={r.accumulativeChurnRate} />,
    },
  ]

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="h-56 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
    </div>
  )

  const hasFilters = country || leadSources.length > 0
  const chartData = byQuarter.filter((r) => r.logoChurnRate !== null && r.logoChurnRate !== undefined)

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
        <LeadSourceFilter value={leadSources} onChange={setLeadSources} />
        {hasFilters && (
          <button onClick={() => { setCountry(''); setLeadSources([]) }} className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Avg Quarterly Churn" value={avgChurnRate} format="percent" accent="#ef4444" />
        <KPICard label="Cancelled Logos" value={totalChurnedLogos} format="integer" accent="#f97316"
          subLabel="Explicit cancellations" />
        <KPICard label="Expired Logos" value={totalExpiredLogos} format="integer" accent="#f59e0b"
          subLabel="Natural contract lapse" />
        <KPICard label="Accumulative Loss" value={totalAccumulativeChurn} format="integer" accent="#6b7280"
          subLabel={`${(avgAccumulativeChurnRate * 100).toFixed(1)}% avg quarterly rate`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard label="Total New Logos" value={totalNewLogos} format="integer" accent="#49B697" />
        <KPICard label="Avg Account Lifespan" value={avgLifespan} format="number" subLabel="months" accent="#5061F6" />
      </div>

      {/* Churn Rate Trend Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Churn Rate Trend (by Quarter)</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<ChurnTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line
                type="monotone"
                dataKey="logoChurnRate"
                name="Cancelled"
                stroke="#5061F6"
                strokeWidth={2.5}
                dot={{ fill: '#5061F6', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#5061F6', stroke: '#F5F2FF', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="expiredRate"
                name="Expired (Natural)"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#f59e0b', stroke: '#FFF7ED', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="accumulativeChurnRate"
                name="Accumulative"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#ef4444', stroke: '#FEF2F2', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tables */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-[#5061F6]" />
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Logo Churn by Quarter</h2>
          </div>
          <DataTable columns={quarterCols} data={byQuarter} exportFilename="churn-quarter.csv" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-[#49B697]" />
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Churn by Lead Source</h2>
          </div>
          <DataTable columns={sourceCols} data={byLeadSource} exportFilename="churn-leadsource.csv" />
        </div>
      </div>
    </div>
  )
}
