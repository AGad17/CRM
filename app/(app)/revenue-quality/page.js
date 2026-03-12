'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'

function usd(v) { return `USD ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }
function pct(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—' }

const PIE_COLORS = ['#5061F6', '#49B697', '#C2B4FB', '#F4BF1D', '#AAB3FA', '#9ca3af']

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700">{d.name}</p>
      <p style={{ color: d.payload.fill }} className="font-semibold">{usd(d.value)}</p>
      <p className="text-gray-400">{pct(d.payload.share)}</p>
    </div>
  )
}

function ConcentrationBar({ value }) {
  const percent = Math.min(100, (value || 0) * 100)
  const color = percent > 80 ? '#ef4444' : percent > 60 ? '#f97316' : '#5061F6'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[60px]">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
      <span className="text-xs tabular-nums w-12 text-right" style={{ color }}>{pct(value)}</span>
    </div>
  )
}

export default function RevenueQualityPage() {
  const [country, setCountry] = useState('')
  const [topN, setTopN] = useState(10)

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-quality', country],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      return fetch(`/api/analytics/revenue-quality?${p}`).then((r) => r.json())
    },
  })

  const concentration = data?.concentration || []
  const mrrPerBranch = data?.mrrPerBranch || []

  // Derived KPIs
  const totalMRR = concentration.reduce((s, r) => s + (r.mrr || 0), 0)
  const top5MRR = concentration.slice(0, 5).reduce((s, r) => s + (r.mrr || 0), 0)
  const top10MRR = concentration.slice(0, 10).reduce((s, r) => s + (r.mrr || 0), 0)
  const top5Share = totalMRR > 0 ? top5MRR / totalMRR : 0
  const top10Share = totalMRR > 0 ? top10MRR / totalMRR : 0

  // Pie chart data: top 5 + rest
  const top5 = concentration.slice(0, 5)
  const restMRR = concentration.slice(5).reduce((s, r) => s + (r.mrr || 0), 0)
  const pieData = [
    ...top5.map((r) => ({ name: r.name, value: r.mrr, share: r.percentOfTotal, fill: PIE_COLORS[top5.indexOf(r)] })),
    ...(restMRR > 0 ? [{ name: 'Others', value: restMRR, share: restMRR / totalMRR, fill: PIE_COLORS[5] }] : []),
  ]

  // Filtered concentration table
  const visibleConc = concentration.slice(0, topN)

  const concCols = [
    { key: 'rank', label: '#', sortable: false },
    { key: 'name', label: 'Account', rtl: true },
    { key: 'mrr', label: 'MRR', render: (r) => usd(r.mrr) },
    { key: 'percentOfTotal', label: '% of MRR', render: (r) => pct(r.percentOfTotal) },
    {
      key: 'cumulativePercent', label: 'Cumulative %', sortable: false,
      render: (r) => <ConcentrationBar value={r.cumulativePercent} />,
    },
  ]

  const mrrCols = [
    { key: 'quarter', label: 'Quarter' },
    { key: 'totalMRR', label: 'Total MRR', render: (r) => usd(r.totalMRR) },
    { key: 'activeAccounts', label: 'Active Accounts' },
    { key: 'avgMRRPerAccount', label: 'Avg MRR / Account', render: (r) => usd(r.avgMRRPerAccount) },
    { key: 'arr', label: 'ARR', render: (r) => usd(r.arr) },
  ]

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
    </div>
  )

  const hasFilters = !!country

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
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-gray-400 font-medium">Show top</span>
          <select
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
          >
            {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} accounts</option>)}
          </select>
        </div>
        {hasFilters && (
          <button onClick={() => setCountry('')} className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">
            Clear filters
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total MRR" value={totalMRR} format="currency" accent="#5061F6" />
        <KPICard label="Top 5 Share" value={top5Share} format="percent" subLabel="of total MRR" accent={top5Share > 0.5 ? '#ef4444' : '#F4BF1D'} />
        <KPICard label="Top 10 Share" value={top10Share} format="percent" subLabel="of total MRR" accent={top10Share > 0.7 ? '#ef4444' : '#49B697'} />
        <KPICard label="Total Accounts" value={concentration.length} format="integer" accent="#C2B4FB" />
      </div>

      {/* Pie Chart + Concentration Table side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pie Chart */}
        {pieData.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Top 5 vs Others</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-gray-600 font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Concentration Table */}
        <div className={pieData.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#5061F6]" />
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Revenue Concentration Risk (Pareto)</h2>
            </div>
          </div>
          <DataTable columns={concCols} data={visibleConc} exportFilename="revenue-concentration.csv" />
        </div>
      </div>

      {/* MRR per Account by Quarter */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-[#49B697]" />
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">MRR per Account by Quarter</h2>
        </div>
        <DataTable columns={mrrCols} data={mrrPerBranch} exportFilename="mrr-per-account.csv" />
      </div>
    </div>
  )
}
