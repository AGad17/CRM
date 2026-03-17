'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LeadSourceFilter } from '@/components/ui/LeadSourceFilter'

function pct(v) {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function cellStyle(v) {
  if (v === null || v === undefined) return { bg: 'bg-gray-50', text: 'text-gray-300', border: '' }
  if (v < 0.7)  return { bg: 'bg-red-50',     text: 'text-red-600 font-semibold',    border: 'border border-red-100' }
  if (v < 0.9)  return { bg: 'bg-amber-50',   text: 'text-amber-700 font-semibold',  border: 'border border-amber-100' }
  return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border border-emerald-100' }
}

export default function CohortsPage() {
  const [country, setCountry] = useState('')
  const [leadSources, setLeadSources] = useState([])

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['cohorts', country, leadSources],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSources.length > 0) p.set('leadSources', leadSources.join(','))
      return fetch(`/api/analytics/cohorts?${p}`).then((r) => r.json())
    },
  })

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
  if (!data.length) return <div className="text-sm text-gray-400 text-center py-16">No cohort data available yet.</div>

  const hasFilters = !!country || leadSources.length > 0

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
        <LeadSourceFilter value={leadSources} onChange={setLeadSources} />
        {hasFilters && (
          <button onClick={() => { setCountry('')} className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">
            Clear filters
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Legend</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
          <span>≥90% — Healthy</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-200" />
          <span>70–90% — Watch</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
          <span>&lt;70% — At Risk</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-gray-100" />
          <span>No Data</span>
        </span>
      </div>

      {/* Cohort Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-widest sticky left-0 bg-transparent whitespace-nowrap">
                Cohort
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Initial MRR</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest">Accounts</th>
              {['Q+1', 'Q+2', 'Q+3', 'Q+4', 'Q+5', 'Q+6'].map((q) => (
                <th key={q} className="px-4 py-3 text-center text-[11px] font-bold text-[#5061F6] uppercase tracking-widest">{q}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row) => (
              <tr key={row.cohort} className="hover:bg-[#F5F2FF]/40 transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap sticky left-0 bg-white text-sm">
                  {row.cohort}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 text-sm tabular-nums">
                  USD {Number(row.initialMRR || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 text-sm">{row.initialAccounts}</td>
                {[1, 2, 3, 4, 5, 6].map((i) => {
                  const { bg, text, border } = cellStyle(row[`q${i}`])
                  return (
                    <td key={i} className="px-2 py-2 text-center">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs ${bg} ${text} ${border}`}>
                        {pct(row[`q${i}`])}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
