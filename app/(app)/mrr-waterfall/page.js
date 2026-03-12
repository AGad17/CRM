'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { KPICard } from '@/components/ui/KPICard'

const SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']

function usd(v) { return `USD ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }
function fmt(v) { if (v == null) return '—'; return usd(v) }

function WaterfallTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs space-y-1 min-w-[160px]">
      <p className="font-bold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p) => p.value !== 0 && (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold text-gray-700">{usd(Math.abs(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export default function MRRWaterfallPage() {
  const [country, setCountry] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['mrr-waterfall', country, leadSource],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSource) p.set('leadSource', leadSource)
      return fetch(`/api/analytics/mrr-waterfall?${p}`).then((r) => r.json())
    },
  })

  const years = useMemo(() => [...new Set(data.map((r) => Number(r.period.split('-')[0])))].sort(), [data])
  const filtered = useMemo(() => data.filter((r) => {
    const y = Number(r.period.split('-')[0])
    if (yearFrom && y < Number(yearFrom)) return false
    if (yearTo && y > Number(yearTo)) return false
    return true
  }), [data, yearFrom, yearTo])

  const latest = filtered[filtered.length - 1] || {}
  const hasFilters = country || leadSource || yearFrom || yearTo

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
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
        <KPICard label="Latest Starting MRR" value={latest.startingMRR} format="currency" accent="#5061F6" />
        <KPICard label="Latest New MRR" value={latest.newMRR} format="currency" accent="#49B697" />
        <KPICard label="Latest Churned MRR" value={latest.churnedMRR} format="currency" accent="#ef4444" />
        <KPICard label="Latest Net New MRR" value={latest.netNewMRR} format="currency"
          accent={(latest.netNewMRR || 0) >= 0 ? '#49B697' : '#ef4444'} />
      </div>

      {/* Waterfall Chart */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">MRR Components by Month</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={filtered} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<WaterfallTooltip />} cursor={{ fill: '#F5F2FF' }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-gray-600 font-medium">{v}</span>} />
              <Bar dataKey="newMRR" name="New MRR" stackId="a" fill="#49B697" radius={[0, 0, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expansionMRR" name="Expansion" stackId="a" fill="#5061F6" maxBarSize={28} />
              <Bar dataKey="renewalMRR" name="Renewal" stackId="a" fill="#C2B4FB" maxBarSize={28} />
              <Bar dataKey="churnedMRR" name="Churned" stackId="b" fill="#fca5a5" radius={[0, 0, 4, 4]} maxBarSize={28} />
              <Line type="monotone" dataKey="endingMRR" name="Ending MRR" stroke="#2E1065" strokeWidth={2}
                dot={{ r: 3, fill: '#2E1065', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#2E1065', stroke: '#F5F2FF', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
              {['Month', 'Starting MRR', 'New MRR', 'Expansion', 'Renewal', 'Churned MRR', 'Net New MRR', 'Ending MRR'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right first:text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.period} className="hover:bg-[#F5F2FF]/40 transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-white">{r.period}</td>
                <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{fmt(r.startingMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700">{fmt(r.newMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-[#5061F6]">{fmt(r.expansionMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#C2B4FB] font-medium">{fmt(r.renewalMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">{fmt(r.churnedMRR)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: (r.netNewMRR || 0) >= 0 ? '#49B697' : '#ef4444' }}>
                  {fmt(r.netNewMRR)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-[#2E1065]">{fmt(r.endingMRR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
