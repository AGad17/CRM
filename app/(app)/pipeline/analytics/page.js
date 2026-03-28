'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  BarChart, Bar, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { LeadSourceFilter } from '@/components/ui/LeadSourceFilter'

const STAGE_COLORS = {
  Lead:       '#94a3b8',
  Qualified:  '#6366f1',
  ClosedWon:  '#10b981',
  Expired:    '#f97316',
  ClosedLost: '#ef4444',
  Churned:    '#f59e0b',
}

function pct(v) { return `${(v * 100).toFixed(1)}%` }
function usd(v) { return `USD ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}` }

// ── DataTable column sets ─────────────────────────────────────────────────────

function channelCols() {
  return [
    { key: 'channel',  label: 'Channel',     render: r => <span className="font-medium text-gray-800">{r.channel}</span> },
    { key: 'total',    label: 'Total',        render: r => r.total,    getValue: r => String(r.total) },
    { key: 'won',      label: 'Won',          render: r => r.won,      getValue: r => String(r.won) },
    { key: 'lost',     label: 'Lost',         render: r => r.lost,     getValue: r => String(r.lost) },
    {
      key: 'winRate', label: 'Win Rate',
      render:   r => <span className="font-semibold text-emerald-600">{pct(r.winRate)}</span>,
      getValue: r => (r.winRate * 100).toFixed(1),
    },
    {
      key: 'avgValue', label: 'Avg Value',
      render:   r => usd(r.avgValue),
      getValue: r => r.avgValue.toFixed(0),
    },
  ]
}

function countryCols() {
  return [
    { key: 'country',       label: 'Country',         render: r => <span className="font-medium text-gray-800">{r.country}</span> },
    { key: 'total',         label: 'Total',            render: r => r.total,          getValue: r => String(r.total) },
    { key: 'won',           label: 'Won',              render: r => r.won,            getValue: r => String(r.won) },
    {
      key: 'winRate', label: 'Win Rate',
      render:   r => <span className="font-semibold text-emerald-600">{pct(r.winRate)}</span>,
      getValue: r => (r.winRate * 100).toFixed(1),
    },
    {
      key: 'pipelineValue', label: 'Pipeline Value',
      render:   r => usd(r.pipelineValue),
      getValue: r => r.pipelineValue.toFixed(0),
    },
  ]
}

function ownerCols() {
  return [
    { key: 'ownerName',  label: 'Owner',      render: r => <span className="font-medium text-gray-800">{r.ownerName}</span> },
    { key: 'total',      label: 'Total',       render: r => r.total,      getValue: r => String(r.total) },
    { key: 'won',        label: 'Won',         render: r => r.won,        getValue: r => String(r.won) },
    { key: 'lost',       label: 'Lost',        render: r => r.lost,       getValue: r => String(r.lost) },
    { key: 'inPipeline', label: 'In Pipeline', render: r => r.inPipeline, getValue: r => String(r.inPipeline) },
    {
      key: 'winRate', label: 'Win Rate',
      render:   r => <span className="font-semibold text-emerald-600">{pct(r.winRate)}</span>,
      getValue: r => (r.winRate * 100).toFixed(1),
    },
  ]
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-gray-200 rounded-2xl" />
        <div className="h-72 bg-gray-200 rounded-2xl" />
      </div>
      <div className="h-48 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
    </div>
  )
}

// ── Date range presets ─────────────────────────────────────────────────────────
function getPreset(key) {
  const now = new Date()
  const fmt  = (d) => d.toISOString().slice(0, 10)
  if (key === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: fmt(from), to: fmt(now) }
  }
  if (key === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), q * 3, 1)
    return { from: fmt(from), to: fmt(now) }
  }
  if (key === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: fmt(now) }
  }
  return { from: '', to: '' } // all time
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PipelineAnalyticsPage() {
  const [country, setCountry] = useState('')
  const [leadSources, setLeadSources] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [preset,   setPreset]   = useState('') // 'month'|'quarter'|'year'|''

  function applyPreset(key) {
    const { from, to } = getPreset(key)
    setDateFrom(from); setDateTo(to); setPreset(key)
  }

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-analytics', country, leadSources, dateFrom, dateTo],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSources.length > 0) p.set('leadSources', leadSources.join(','))
      if (dateFrom) p.set('from', dateFrom)
      if (dateTo)   p.set('to',   dateTo)
      return fetch(`/api/pipeline/analytics?${p}`).then(r => r.json())
    },
    staleTime: 60_000,
  })

  const { summary, byStage, byChannel, byCountry, byOwner, monthlyTrend = [], byLostReason = [] } = data || {}

  const hasFilters = country || leadSources.length > 0 || dateFrom || dateTo

  if (isLoading) return <Skeleton />
  if (!data) return <div className="text-red-500">Failed to load analytics.</div>

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pipeline Analytics</h2>
          <p className="text-sm text-gray-400 mt-0.5">Aggregated from all lead records</p>
        </div>
        <Link href="/pipeline" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium">
          ← Pipeline
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Filter</span>
        <LeadSourceFilter value={leadSources} onChange={setLeadSources} />
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>

        {/* Date range presets */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {[{ key: '', label: 'All time' }, { key: 'year', label: 'This Year' }, { key: 'quarter', label: 'This Quarter' }, { key: 'month', label: 'This Month' }].map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${preset === p.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset('custom') }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset('custom') }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />

        {hasFilters && (
          <button onClick={() => { setCountry(''); setLeadSources([]); setDateFrom(''); setDateTo(''); setPreset('') }}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold underline underline-offset-2">Clear all</button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Total Leads"       value={summary.total}            format="integer" />
        <KPICard label="Win Rate"          value={summary.winRate * 100}    format="percent" />
        <KPICard label="Avg Days to Close" value={summary.avgDaysToClose}   format="integer" />
        <KPICard label="Pipeline Value"    value={summary.pipelineValue}    format="number"  />
        <KPICard label="Won This Month"    value={summary.wonThisMonth}     format="integer" />
        <KPICard label="Weighted Forecast" value={summary.weightedForecast} format="number"  />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Stage Funnel — horizontal bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Stage Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={byStage}
              layout="vertical"
              margin={{ left: 16, right: 24, top: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, 'Count']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {byStage.map(e => (
                  <Cell key={e.stage} fill={STAGE_COLORS[e.stage] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend — area chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Monthly Trend (12 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={monthlyTrend}
              margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorLost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpired" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="created" name="Created" stroke="#6366f1" fill="url(#colorCreated)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="won"     name="Won"     stroke="#10b981" fill="url(#colorWon)"     strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="lost"    name="Lost"    stroke="#ef4444" fill="url(#colorLost)"    strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expired" name="Expired" stroke="#f97316" fill="url(#colorExpired)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown Tables */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">By Channel</h3>
        <DataTable columns={channelCols()} data={byChannel} exportFilename="pipeline-by-channel.csv" />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">By Country</h3>
        <DataTable columns={countryCols()} data={byCountry} exportFilename="pipeline-by-country.csv" />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">By Owner</h3>
        <DataTable columns={ownerCols()} data={byOwner} exportFilename="pipeline-by-owner.csv" />
      </section>

      {/* Lost by Reason */}
      {byLostReason.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Lost by Reason</h3>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byLostReason} layout="vertical" margin={{ left: 16, right: 32, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="reason" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Leads']} />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-2">
              {byLostReason.map((r) => (
                <span key={r.reason} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-red-50 text-red-700 border border-red-100 font-medium">
                  {r.reason} <span className="font-bold">{r.count}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  )
}
