'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'

const SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']
const BAR_COLORS = ['#5061F6', '#49B697', '#C2B4FB', '#F4BF1D', '#AAB3FA', '#f97316', '#ec4899', '#06b6d4']

function pct(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—' }
function usd(v) { return `USD ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700">{d.payload.country}</p>
      <p className="text-[#5061F6] font-semibold">{usd(d.value)}</p>
    </div>
  )
}

export default function SegmentsPage() {
  const [country, setCountry] = useState('')
  const [leadSource, setLeadSource] = useState('')

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['segments', country, leadSource],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSource) p.set('leadSource', leadSource)
      return fetch(`/api/analytics/segments?${p}`).then((r) => r.json())
    },
  })

  const byCountry = data?.byCountry || []
  const byLeadSource = data?.byLeadSource || []

  // Derived KPIs
  const totalMRR = byCountry.reduce((s, r) => s + (r.totalMRR || 0), 0)
  const activeAccounts = byCountry.reduce((s, r) => s + (r.activeAccounts || 0), 0)
  const countriesCount = byCountry.length
  const totalChurned = byCountry.reduce((s, r) => s + (r.churnedAccounts || 0), 0)
  const totalAll = activeAccounts + totalChurned
  const overallChurn = totalAll > 0 ? totalChurned / totalAll : 0

  const countryCols = [
    { key: 'country', label: 'Country' },
    { key: 'totalMRR', label: 'Total MRR', render: (r) => usd(r.totalMRR) },
    { key: 'contracts', label: 'Contracts' },
    { key: 'contractValue', label: 'Contract Value', render: (r) => usd(r.contractValue) },
    { key: 'activeAccounts', label: 'Active' },
    { key: 'churnedAccounts', label: 'Churned' },
    {
      key: 'churnRate', label: 'Churn Rate', render: (r) => {
        const v = r.churnRate
        const color = v > 0.2 ? 'text-red-600 bg-red-50' : v > 0.1 ? 'text-amber-600 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
        return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct(v)}</span>
      },
    },
    { key: 'percentOfTotalMRR', label: '% of MRR', render: (r) => pct(r.percentOfTotalMRR) },
  ]

  const sourceCols = [
    { key: 'leadSource', label: 'Lead Source', render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'total', label: 'Total' },
    { key: 'active', label: 'Active' },
    { key: 'churned', label: 'Churned' },
    {
      key: 'churnRate', label: 'Churn Rate', render: (r) => {
        const v = r.churnRate
        const color = v > 0.2 ? 'text-red-600 bg-red-50' : v > 0.1 ? 'text-amber-600 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
        return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct(v)}</span>
      },
    },
    { key: 'percentOfTotal', label: '% of Total', render: (r) => pct(r.percentOfTotal) },
  ]

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><div className="h-48 bg-gray-200 rounded-2xl" /><div className="h-48 bg-gray-200 rounded-2xl" /></div>
    </div>
  )

  const hasFilters = country || leadSource

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
        <KPICard label="Total MRR" value={totalMRR} format="currency" accent="#5061F6" />
        <KPICard label="Active Accounts" value={activeAccounts} format="integer" accent="#49B697" />
        <KPICard label="Countries" value={countriesCount} format="integer" accent="#C2B4FB" />
        <KPICard label="Overall Churn Rate" value={overallChurn} format="percent" accent="#F4BF1D" />
      </div>

      {/* MRR by Country Chart */}
      {byCountry.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">MRR Distribution by Country</p>
          <ResponsiveContainer width="100%" height={Math.max(180, byCountry.length * 48)}>
            <BarChart data={byCountry} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => `USD ${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="country"
                type="category"
                tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip content={<TooltipContent />} cursor={{ fill: '#F5F2FF' }} />
              <Bar dataKey="totalMRR" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {byCountry.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-[#5061F6]" />
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Revenue by Country</h2>
          </div>
          <DataTable columns={countryCols} data={byCountry} exportFilename="segments-country.csv" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-[#49B697]" />
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Accounts by Lead Source</h2>
          </div>
          <DataTable columns={sourceCols} data={byLeadSource} exportFilename="segments-leadsource.csv" />
        </div>
      </div>
    </div>
  )
}
