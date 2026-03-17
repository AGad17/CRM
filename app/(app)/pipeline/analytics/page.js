'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  BarChart, Bar, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'

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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PipelineAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-analytics'],
    queryFn:  () => fetch('/api/pipeline/analytics').then(r => r.json()),
    staleTime: 60_000,
  })

  if (isLoading) return <Skeleton />
  if (!data) return <div className="text-red-500">Failed to load analytics.</div>

  const { summary, byStage, byChannel, byCountry, byOwner, monthlyTrend } = data

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

    </div>
  )
}
