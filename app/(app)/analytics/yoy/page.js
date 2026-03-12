'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { AnalyticsTable } from '../_components/AnalyticsTable'

function MRRTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700">{label}</p>
      <p className="text-[#5061F6] font-semibold">
        USD {Number(payload[0].value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

export default function YoYPage() {
  const [country, setCountry] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['analytics-yoy', country],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      return fetch(`/api/analytics/yoy?${p}`).then((r) => r.json())
    },
  })

  const years = useMemo(() => [...new Set(data.map((r) => Number(r.period)))].sort(), [data])

  const filtered = useMemo(() => data.filter((r) => {
    const y = Number(r.period)
    if (yearFrom && y < Number(yearFrom)) return false
    if (yearTo && y > Number(yearTo)) return false
    return true
  }), [data, yearFrom, yearTo])

  const hasFilters = country || yearFrom || yearTo
  const chartData = filtered.filter((r) => r.totalMRRSigned != null)

  return (
    <div className="space-y-5">
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
          value={yearFrom}
          onChange={(e) => setYearFrom(e.target.value)}
        >
          <option value="">From Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={yearTo}
          onChange={(e) => setYearTo(e.target.value)}
        >
          <option value="">To Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {hasFilters && (
          <button
            className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2"
            onClick={() => { setCountry(''); setYearFrom(''); setYearTo('') }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* MRR Bar Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Total MRR Signed by Year</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `USD ${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip content={<MRRTooltip />} cursor={{ fill: '#F5F2FF' }} />
              <Bar dataKey="totalMRRSigned" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#5061F6' : '#C2B4FB'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <AnalyticsTable data={filtered} isLoading={isLoading} periodLabel="Year" exportFilename="yoy.csv" />
    </div>
  )
}
