'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'

const SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']

function pct(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—' }

function ChurnTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      <p className="text-[#5061F6] font-semibold">Churn Rate: {(payload[0].value * 100).toFixed(1)}%</p>
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
  const [leadSource, setLeadSource] = useState('')

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['churn', country, leadSource],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSource) p.set('leadSource', leadSource)
      return fetch(`/api/analytics/churn?${p}`).then((r) => r.json())
    },
  })

  const byQuarter = data?.byQuarter || []
  const byLeadSource = data?.byLeadSource || []

  // Derived KPIs
  const totalChurnedLogos = byQuarter.reduce((s, r) => s + (r.churnedLogos || 0), 0)
  const totalNewLogos = byQuarter.reduce((s, r) => s + (r.newLogos || 0), 0)
  const avgChurnRate = byQuarter.length > 0
    ? byQuarter.reduce((s, r) => s + (r.logoChurnRate || 0), 0) / byQuarter.length
    : 0
  const lifespans = byQuarter.filter((r) => r.avgLifespan).map((r) => r.avgLifespan)
  const avgLifespan = lifespans.length > 0 ? lifespans.reduce((a, b) => a + b, 0) / lifespans.length : null

  const quarterCols = [
    { key: 'quarter', label: 'Quarter' },
    { key: 'activeAtStart', label: 'Active at Start', render: (r) => r.activeAtStart?.length ?? 0 },
    { key: 'newLogos', label: 'New Logos' },
    { key: 'churnedLogos', label: 'Churned Logos' },
    {
      key: 'logoChurnRate', label: 'Logo Churn Rate',
      render: (r) => <ChurnRateBadge value={r.logoChurnRate} />,
    },
    { key: 'avgLifespan', label: 'Avg Lifespan', render: (r) => r.avgLifespan ? `${r.avgLifespan.toFixed(1)} mo` : '—' },
  ]

  const sourceCols = [
    { key: 'leadSource', label: 'Lead Source', render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'totalAccounts', label: 'Total' },
    { key: 'active', label: 'Active' },
    { key: 'churned', label: 'Churned' },
    {
      key: 'churnRate', label: 'Churn Rate',
      render: (r) => <ChurnRateBadge value={r.churnRate} />,
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

  const hasFilters = country || leadSource
  // Chart data — only quarters that have churn data
  const chartData = byQuarter.filter((r) => r.logoChurnRate !== null && r.logoChurnRate !== undefined)

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={leadSource}
          onChange={(e) => setLeadSource(e.target.value)}
        >
          <option value="">All Lead Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/([A-Z])/g, ' $1').trim()}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setCountry(''); setLeadSource('') }} className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Avg Quarterly Churn" value={avgChurnRate} format="percent" accent="#ef4444" />
        <KPICard label="Total Churned Logos" value={totalChurnedLogos} format="integer" accent="#f97316" />
        <KPICard label="Total New Logos" value={totalNewLogos} format="integer" accent="#49B697" />
        <KPICard label="Avg Account Lifespan" value={avgLifespan} format="number" subLabel="months" accent="#5061F6" />
      </div>

      {/* Churn Rate Trend Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Logo Churn Rate Trend (by Quarter)</p>
          <ResponsiveContainer width="100%" height={220}>
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
              <Line
                type="monotone"
                dataKey="logoChurnRate"
                stroke="#5061F6"
                strokeWidth={2.5}
                dot={{ fill: '#5061F6', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#5061F6', stroke: '#F5F2FF', strokeWidth: 2 }}
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
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Logo Churn Rate by Quarter</h2>
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
