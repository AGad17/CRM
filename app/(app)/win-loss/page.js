'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { PageError } from '@/components/ui/PageError'
import { LeadSourceFilter } from '@/components/ui/LeadSourceFilter'

function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }
function usd(v) { return v != null ? `USD ${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—' }
function label(s) { return s?.replace(/([A-Z])/g, ' $1').trim() || s }

function BarTooltip({ active, payload, label: l }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs min-w-[140px]">
      <p className="font-bold text-gray-700 mb-1">{l}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold text-gray-700">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function LineTooltip({ active, payload, label: l }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700">{l}</p>
      <p className="text-[#5061F6] font-semibold">Win Rate: {(payload[0].value * 100).toFixed(1)}%</p>
    </div>
  )
}

export default function WinLossPage() {
  const [country, setCountry] = useState('')
  const [leadSources, setLeadSources] = useState([])

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['win-loss', country, leadSources],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSources.length > 0) p.set('leadSources', leadSources.join(','))
      return fetch(`/api/analytics/win-loss?${p}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load win/loss data')
        return r.json()
      })
    },
  })

  const summary = data?.summary || {}
  const byChannel = data?.byChannel || []
  const byQuarter = data?.byQuarter || []
  const byLostReason = data?.byLostReason || []

  const channelCols = [
    { key: 'channel', label: 'Lead Source', render: (r) => label(r.channel) },
    { key: 'total', label: 'Total Leads' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
    {
      key: 'winRate', label: 'Win Rate', render: (r) => {
        const v = r.winRate
        const color = v >= 0.5 ? 'text-emerald-700 bg-emerald-50' : v >= 0.3 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
        return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct(v)}</span>
      },
    },
    { key: 'avgVelocity', label: 'Avg Days to Close', render: (r) => r.avgVelocity != null ? `${r.avgVelocity.toFixed(0)} days` : '—' },
    { key: 'avgDealSize', label: 'Avg Deal Size', render: (r) => usd(r.avgDealSize) },
  ]

  const reasonCols = [
    { key: 'reason', label: 'Lost Reason' },
    { key: 'count', label: 'Count' },
    {
      key: 'pct', label: '% of Lost', render: (r) => {
        const v = r.pct
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
              <div className="h-1.5 rounded-full bg-[#5061F6]" style={{ width: `${(v * 100).toFixed(0)}%` }} />
            </div>
            <span className="text-xs tabular-nums w-10 text-right text-[#5061F6] font-semibold">{pct(v)}</span>
          </div>
        )
      },
    },
  ]

  const chartData = byChannel.map((r) => ({ name: label(r.channel), won: r.won, lost: r.lost }))
  const chartQuarter = byQuarter.filter((r) => r.winRate != null)

  if (isError) return <PageError onRetry={refetch} />

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="h-56 bg-gray-200 rounded-2xl" /><div className="h-56 bg-gray-200 rounded-2xl" /></div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
        <LeadSourceFilter value={leadSources} onChange={setLeadSources} />
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        {(country || leadSources.length > 0) && (
          <button onClick={() => { setCountry(''); setLeadSources([]) }}
            className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">Clear all</button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard label="Win Rate" value={summary.overallWinRate} format="percent" accent="#49B697" />
        <KPICard label="Total Leads" value={summary.totalLeads} format="integer" accent="#5061F6" />
        <KPICard label="Won" value={summary.totalWon} format="integer" accent="#49B697" />
        <KPICard label="Lost" value={summary.totalLost} format="integer" accent="#ef4444" />
        <KPICard label="Avg Days to Close" value={summary.avgVelocity} format="number" subLabel="days (won deals)" accent="#F4BF1D" />
      </div>

      {/* Empty state */}
      {byChannel.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
          <p className="text-sm text-gray-400">No win/loss data found{country ? ' for the selected country' : ''}. Close some leads to see results.</p>
        </div>
      )}

      {/* Charts + tables — only when there's data */}
      {byChannel.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Won vs Lost by channel */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Won vs Lost by Lead Source</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: '#F5F2FF' }} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-xs text-gray-600 font-medium">{v}</span>} />
                    <Bar dataKey="won" name="Won" fill="#49B697" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="lost" name="Lost" fill="#fca5a5" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Win rate trend */}
            {chartQuarter.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Win Rate Trend by Quarter</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartQuarter} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<LineTooltip />} />
                    <Line type="monotone" dataKey="winRate" stroke="#5061F6" strokeWidth={2.5}
                      dot={{ fill: '#5061F6', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#5061F6', stroke: '#F5F2FF', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Channel table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-[#5061F6]" />
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Win/Loss by Lead Source</h2>
            </div>
            <DataTable columns={channelCols} data={byChannel} exportFilename="win-loss.csv" />
          </div>
        </>
      )}

      {/* Lost reasons */}
      {byLostReason.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-red-400" />
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Lost Reasons</h2>
          </div>
          <DataTable columns={reasonCols} data={byLostReason} exportFilename="lost-reasons.csv" />
        </div>
      )}
    </div>
  )
}
