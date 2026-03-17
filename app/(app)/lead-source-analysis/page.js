'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { PageError } from '@/components/ui/PageError'
import { LeadSourceFilter } from '@/components/ui/LeadSourceFilter'

const COLORS = ['#5061F6', '#49B697', '#F4BF1D', '#C2B4FB', '#AAB3FA', '#f97316', '#ec4899', '#06b6d4']

function usd(v) { return `USD ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }
function label(s) { return s?.replace(/([A-Z])/g, ' $1').trim() || s }

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700">{label(payload[0].payload.leadSource)}</p>
      <p style={{ color: payload[0].fill }} className="font-semibold">{usd(payload[0].value)}</p>
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700">{label(payload[0].name)}</p>
      <p style={{ color: payload[0].payload.fill }} className="font-semibold">{payload[0].payload.totalAccounts} accounts</p>
      <p className="text-gray-400">{pct(payload[0].payload.percentOfAccounts)}</p>
    </div>
  )
}

export default function LeadSourceAnalysisPage() {
  const [country, setCountry] = useState('')
  const [leadSources, setLeadSources] = useState([])

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['lead-source', country, leadSources],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSources.length > 0) p.set('leadSources', leadSources.join(','))
      return fetch(`/api/analytics/lead-source?${p}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load lead source data')
        return r.json()
      })
    },
  })

  const bySource = data?.bySource || []
  const totalMRR = bySource.reduce((s, r) => s + (r.mrr || 0), 0)
  const totalAccounts = bySource.reduce((s, r) => s + (r.totalAccounts || 0), 0)
  const topByMRR = bySource[0]
  const topByCount = [...bySource].sort((a, b) => b.totalAccounts - a.totalAccounts)[0]

  const tableCols = [
    { key: 'leadSource', label: 'Lead Source', render: (r) => label(r.leadSource) },
    { key: 'totalAccounts', label: 'Total' },
    { key: 'activeAccounts', label: 'Active' },
    { key: 'churnedAccounts', label: 'Churned' },
    {
      key: 'churnRate', label: 'Churn Rate', render: (r) => {
        const v = r.churnRate
        const color = v > 0.2 ? 'text-red-600 bg-red-50' : v > 0.1 ? 'text-amber-600 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
        return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct(v)}</span>
      },
    },
    { key: 'mrr', label: 'MRR', render: (r) => usd(r.mrr) },
    { key: 'avgMRRPerAccount', label: 'Avg MRR/Account', render: (r) => usd(r.avgMRRPerAccount) },
    { key: 'percentOfMRR', label: '% of MRR', render: (r) => pct(r.percentOfMRR) },
    { key: 'percentOfAccounts', label: '% of Accounts', render: (r) => pct(r.percentOfAccounts) },
  ]

  if (isError) return <PageError onRetry={refetch} />

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="h-56 bg-gray-200 rounded-2xl" /><div className="h-56 bg-gray-200 rounded-2xl" /></div>
      <div className="h-48 bg-gray-200 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <LeadSourceFilter value={leadSources} onChange={setLeadSources} />
        {(country || leadSources.length > 0) && <button onClick={() => { setCountry(''); setLeadSources([]) }}
          className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">Clear all</button>}
      </div>

      {/* Empty state */}
      {bySource.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
          <p className="text-sm text-gray-400">No lead source data found{country ? ' for the selected country' : ''}.</p>
        </div>
      )}

      {/* KPI Strip */}
      {bySource.length > 0 && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total MRR" value={totalMRR} format="currency" accent="#5061F6" />
        <KPICard label="Total Accounts" value={totalAccounts} format="integer" accent="#C2B4FB" />
        <KPICard label="Top Source by MRR" value={null} format="number"
          subLabel={topByMRR ? `${label(topByMRR.leadSource)} — ${usd(topByMRR.mrr)}` : '—'} accent="#49B697" />
        <KPICard label="Top Source by Count" value={null} format="number"
          subLabel={topByCount ? `${label(topByCount.leadSource)} — ${topByCount.totalAccounts} accts` : '—'} accent="#F4BF1D" />
      </div>}

      {/* Charts */}
      {bySource.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Bar chart */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">MRR by Lead Source</p>
            <ResponsiveContainer width="100%" height={Math.max(180, bySource.length * 48)}>
              <BarChart data={bySource} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 16 }}>
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="leadSource" type="category" tickFormatter={label}
                  tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: '#F5F2FF' }} />
                <Bar dataKey="mrr" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Pie chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Account Distribution</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={bySource.map((r, i) => ({ ...r, name: label(r.leadSource), fill: COLORS[i % COLORS.length] }))}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="totalAccounts">
                  {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-600 font-medium">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      {bySource.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-[#5061F6]" />
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Detailed Breakdown</h2>
          </div>
          <DataTable columns={tableCols} data={bySource} exportFilename="lead-source-analysis.csv" />
        </div>
      )}
    </div>
  )
}
