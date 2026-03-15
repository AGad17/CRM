'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'

const PHASES = ['DealClosure', 'Onboarding', 'Training', 'Incubation', 'AccountManagement', 'Churned']

function scoreLabel(s) {
  if (s === null || s === undefined) return { text: 'No Data', bg: 'bg-gray-100', text_: 'text-gray-400' }
  if (s >= 70) return { text: 'Healthy', bg: 'bg-emerald-50', text_: 'text-emerald-700', border: 'border-emerald-200' }
  if (s >= 40) return { text: 'Watch', bg: 'bg-amber-50', text_: 'text-amber-700', border: 'border-amber-200' }
  return { text: 'At Risk', bg: 'bg-red-50', text_: 'text-red-700', border: 'border-red-200' }
}

function HealthBar({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-300 text-xs">—</span>
  const pct = Math.round(value)
  const color = value >= 70 ? '#49B697' : value >= 40 ? '#F4BF1D' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right font-semibold" style={{ color }}>{pct}</span>
    </div>
  )
}

function pctFmt(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(0)}%` : '—' }
function scoreFmt(v) { return v !== null && v !== undefined ? v.toFixed(1) : '—' }

export default function AccountHealthPage() {
  const [country, setCountry] = useState('')
  const [phase, setPhase] = useState('')
  const [sort, setSort] = useState('asc') // 'asc' = worst first
  const [snapshotMsg, setSnapshotMsg] = useState(null)

  const queryClient = useQueryClient()

  const snapshotMutation = useMutation({
    mutationFn: () => fetch('/api/analytics/health-snapshot', { method: 'POST' }).then((r) => r.json()),
    onSuccess: (data) => {
      setSnapshotMsg(`Snapshot saved for ${data.count} accounts`)
      setTimeout(() => setSnapshotMsg(null), 4000)
      queryClient.invalidateQueries({ queryKey: ['account-health'] })
    },
  })

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['account-health', country, phase],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (phase) p.set('phase', phase)
      return fetch(`/api/analytics/account-health?${p}`).then((r) => r.json())
    },
  })

  const sorted = useMemo(() => {
    const withScore = [...data].sort((a, b) => {
      const sa = a.healthScore ?? (sort === 'asc' ? Infinity : -Infinity)
      const sb = b.healthScore ?? (sort === 'asc' ? Infinity : -Infinity)
      return sort === 'asc' ? sa - sb : sb - sa
    })
    return withScore
  }, [data, sort])

  const healthy = data.filter((r) => (r.healthScore ?? -1) >= 70).length
  const watch = data.filter((r) => r.healthScore !== null && r.healthScore >= 40 && r.healthScore < 70).length
  const atRisk = data.filter((r) => r.healthScore !== null && r.healthScore < 40).length
  const noData = data.filter((r) => r.healthScore === null).length
  const avgScore = data.filter((r) => r.healthScore !== null).length > 0
    ? data.filter((r) => r.healthScore !== null).reduce((s, r) => s + r.healthScore, 0) /
      data.filter((r) => r.healthScore !== null).length
    : null
  const hasFilters = country || phase

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
          value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value="">All Phases</option>
          {PHASES.map((ph) => <option key={ph} value={ph}>{ph.replace(/([A-Z])/g, ' $1').trim()}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-gray-400 font-medium">Sort</span>
          <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
            value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="asc">Worst first</option>
            <option value="desc">Best first</option>
          </select>
        </div>
        {hasFilters && <button onClick={() => { setCountry(''); setPhase('') }}
          className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">Clear all</button>}
        <div className="ml-auto flex items-center gap-2">
          {snapshotMsg && <span className="text-xs text-emerald-600 font-medium">{snapshotMsg}</span>}
          <button
            onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}
            className="text-xs bg-[#5061F6] hover:bg-[#3b4cc4] disabled:opacity-50 text-white font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            {snapshotMutation.isPending ? 'Saving…' : 'Take Snapshot'}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Avg Health Score" value={avgScore} format="number" subLabel="out of 100" accent="#5061F6" />
        <KPICard label="Healthy (≥70)" value={healthy} format="integer" subLabel="accounts" accent="#49B697" />
        <KPICard label="Watch (40–70)" value={watch} format="integer" subLabel="accounts" accent="#F4BF1D" />
        <KPICard label="At Risk (<40)" value={atRisk} format="integer" subLabel={`+ ${noData} no data`} accent="#ef4444" />
      </div>

      {/* Score legend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-5 flex-wrap text-xs text-gray-500">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Score</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" />≥70 Healthy</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />40–70 Watch</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />&lt;40 At Risk</span>
        <span className="text-gray-300 ml-2">Weights: CSAT 40% · NPS 30% · Tasks 30%</span>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-14 text-center">
          <p className="text-sm text-gray-300 font-medium">No onboarding tracker data found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
                {['Account', 'Country', 'Phase', 'CSAT (avg)', 'NPS (avg)', 'Task Completion', 'Health Score'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((r) => {
                const { text, bg, text_, border } = scoreLabel(r.healthScore)
                return (
                  <tr key={r.trackerId} className="hover:bg-[#F5F2FF]/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-800 sticky left-0 bg-white whitespace-nowrap">
                      {r.accountId ? (
                        <a href={`/accounts/${r.accountId}`} className="hover:text-[#5061F6] hover:underline">{r.accountName}</a>
                      ) : r.accountName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.countryName || r.country}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#F5F2FF] text-[#5061F6]">
                        {r.phase?.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.avgCSAT !== null ? r.avgCSAT.toFixed(1) : '—'} {r.csatCount > 0 && <span className="text-gray-400 text-xs">({r.csatCount})</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{r.avgNPS !== null ? r.avgNPS.toFixed(1) : '—'} {r.npsCount > 0 && <span className="text-gray-400 text-xs">({r.npsCount})</span>}</td>
                    <td className="px-4 py-3 min-w-[140px]">
                      {r.taskCompletion !== null
                        ? <div className="space-y-0.5"><span className="text-xs text-gray-500">{r.completedTasks}/{r.totalTasks} tasks</span><HealthBar value={r.taskCompletion * 100} /></div>
                        : <span className="text-gray-300 text-xs">No tasks</span>}
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text_} border ${border || 'border-transparent'}`}>{text}</span>
                          <span className="text-xs font-bold text-gray-700">{scoreFmt(r.healthScore)}</span>
                        </div>
                        <HealthBar value={r.healthScore} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
