'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { KPICard } from '@/components/ui/KPICard'

const SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']

function usd(v) { return `USD ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }
function fmt(v) { if (v == null) return '—'; return usd(v) }

function NRRTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[180px] space-y-1">
      <p className="font-bold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color || '#374151' }}>{p.name}</span>
          <span className="font-semibold text-gray-700">
            {p.name === 'NRR' || p.name === 'GRR' ? pct(p.value) : usd(Math.abs(p.value))}
          </span>
        </div>
      ))}
    </div>
  )
}

function NRRBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>
  const v = value * 100
  if (v >= 110) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">{v.toFixed(1)}%</span>
  if (v >= 100) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-[#5061F6] bg-[#F5F2FF] border border-[#5061F6]/20">{v.toFixed(1)}%</span>
  if (v >= 90) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">{v.toFixed(1)}%</span>
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-red-700 bg-red-50 border border-red-200">{v.toFixed(1)}%</span>
}

export default function NRRBreakdownPage() {
  const [country, setCountry] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['nrr-breakdown', country, leadSource],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSource) p.set('leadSource', leadSource)
      return fetch(`/api/analytics/nrr-breakdown?${p}`).then((r) => r.json())
    },
  })

  const years = useMemo(() => [...new Set(data.map((r) => Number(r.quarter.split(' ')[0])))].sort(), [data])
  const filtered = useMemo(() => data.filter((r) => {
    const y = Number(r.quarter.split(' ')[0])
    if (yearFrom && y < Number(yearFrom)) return false
    if (yearTo && y > Number(yearTo)) return false
    return true
  }), [data, yearFrom, yearTo])

  const latest = filtered[filtered.length - 1] || {}
  const hasFilters = country || leadSource || yearFrom || yearTo

  // Chart data: positive bars (retained + expansion) stacked, negative bar (churned), NRR line
  const chartData = filtered.map((r) => ({
    ...r,
    churnedNeg: -(r.churnedMRR || 0), // make negative for chart display
  }))

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
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
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
          <option value="">All Lead Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/([A-Z])/g, ' $1').trim()}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={yearFrom} onChange={(e) => setYearFrom(e.target.value)}>
          <option value="">From Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={yearTo} onChange={(e) => setYearTo(e.target.value)}>
          <option value="">To Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {hasFilters && <button onClick={() => { setCountry(''); setLeadSource(''); setYearFrom(''); setYearTo('') }}
          className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">Clear all</button>}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Latest NRR" value={latest.nrr} format="percent" subLabel="net revenue retention" accent={(latest.nrr || 0) >= 1 ? '#49B697' : '#ef4444'} />
        <KPICard label="Latest GRR" value={latest.grr} format="percent" subLabel="gross revenue retention" accent={(latest.grr || 0) >= 0.85 ? '#49B697' : '#F4BF1D'} />
        <KPICard label="Latest Expansion MRR" value={latest.expansionMRR} format="currency" accent="#5061F6" />
        <KPICard label="Latest Net New MRR" value={latest.netNewMRR} format="currency" accent={(latest.netNewMRR || 0) >= 0 ? '#49B697' : '#ef4444'} />
      </div>

      {/* NRR Legend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-5 flex-wrap text-xs text-gray-500">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">NRR Targets</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" />≥110% World-class</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#F5F2FF] border border-[#5061F6]/20 inline-block" />100–110% Strong</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />90–100% Needs Attention</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />&lt;90% At Risk</span>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">NRR Components by Quarter</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 48, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="mrr" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<NRRTooltip />} cursor={{ fill: '#F5F2FF' }} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span className="text-xs text-gray-600 font-medium">{v}</span>} />
              <Bar yAxisId="mrr" dataKey="retainedMRR" name="Retained MRR" stackId="a" fill="#C2B4FB" maxBarSize={32} />
              <Bar yAxisId="mrr" dataKey="expansionMRR" name="Expansion MRR" stackId="a" fill="#5061F6" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar yAxisId="mrr" dataKey="churnedNeg" name="Churned MRR" stackId="b" fill="#fca5a5" radius={[0, 0, 4, 4]} maxBarSize={32} />
              <Line yAxisId="pct" type="monotone" dataKey="nrr" name="NRR" stroke="#2E1065" strokeWidth={2.5}
                dot={{ fill: '#2E1065', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#2E1065', stroke: '#F5F2FF', strokeWidth: 2 }} />
              <Line yAxisId="pct" type="monotone" dataKey="grr" name="GRR" stroke="#49B697" strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={{ fill: '#49B697', r: 3, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
              {['Quarter', 'Starting MRR', 'Retained MRR', '+Expansion', '−Churned', 'Ending MRR', 'Net New', 'NRR', 'GRR'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right first:text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.quarter} className="hover:bg-[#F5F2FF]/40 transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-white">{r.quarter}</td>
                <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{fmt(r.startingMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#C2B4FB] font-medium">{fmt(r.retainedMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#5061F6] font-medium">{fmt(r.expansionMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-400 font-medium">{fmt(r.churnedMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-[#2E1065]">{fmt(r.endingMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: (r.netNewMRR || 0) >= 0 ? '#49B697' : '#ef4444' }}>
                  {fmt(r.netNewMRR)}
                </td>
                <td className="px-4 py-3 text-right"><NRRBadge value={r.nrr} /></td>
                <td className="px-4 py-3 text-right text-gray-600 text-xs">{pct(r.grr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
