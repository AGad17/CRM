'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'
import { DeltaBadge } from '@/components/ui/DeltaBadge'
import { PageError } from '@/components/ui/PageError'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

function fmt(v, type = 'number') {
  if (v === null || v === undefined) return '—'
  if (type === 'currency') return `USD ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (type === 'percent') return `${(Number(v) * 100).toFixed(1)}%`
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

const SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']

function SectionHeader({ label, color = '#5061F6' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: color }} />
      <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</h2>
    </div>
  )
}

function MRRChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold text-gray-700">
            {Number(p.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-gray-100 mt-1 pt-1">
        <span className="text-gray-500">Total</span>
        <span className="font-bold text-gray-800">
          {Number(total).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [filters, setFilters] = useState({ country: '', leadSource: '' })

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filters.country) p.set('country', filters.country)
      if (filters.leadSource) p.set('leadSource', filters.leadSource)
      return fetch(`/api/analytics/dashboard?${p}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load dashboard')
        return r.json()
      })
    },
  })

  if (isLoading) return <LoadingSkeleton />
  if (isError || !data) return <PageError onRetry={refetch} />

  const { snapshot, recentMonths, priorMonth, atRiskAccounts = [] } = data
  const hasFilters = filters.country || filters.leadSource

  // MRR chart: oldest → newest left → right
  const chartData = [...recentMonths].reverse().map((m) => ({
    label: m.label,
    'New MRR': Math.round(m.newMRR),
    'Expansion': Math.round(m.expansionMRR),
    'Renewal': Math.round(m.renewalMRR),
    'Churned': Math.round(m.churnedMRR),
  }))

  return (
    <div className="space-y-8">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={filters.country}
          onChange={(e) => setFilters({ ...filters, country: e.target.value })}
        >
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={filters.leadSource}
          onChange={(e) => setFilters({ ...filters, leadSource: e.target.value })}
        >
          <option value="">All Lead Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/([A-Z])/g, ' $1').trim()}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => setFilters({ country: '', leadSource: '' })}
            className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2"
          >
            Clear all
          </button>
        )}
        {filters.country && (
          <span className="text-xs bg-[#F5F2FF] text-[#5061F6] px-2.5 py-1 rounded-full font-semibold border border-[#5061F6]/20 flex items-center gap-1">
            {countries.find((c) => c.code === filters.country)?.name || filters.country}
            <button onClick={() => setFilters({ ...filters, country: '' })} className="hover:text-[#3b4cc4] ml-0.5">✕</button>
          </span>
        )}
        {filters.leadSource && (
          <span className="text-xs bg-[#F5F2FF] text-[#5061F6] px-2.5 py-1 rounded-full font-semibold border border-[#5061F6]/20 flex items-center gap-1">
            {filters.leadSource.replace(/([A-Z])/g, ' $1').trim()}
            <button onClick={() => setFilters({ ...filters, leadSource: '' })} className="hover:text-[#3b4cc4] ml-0.5">✕</button>
          </span>
        )}
      </div>

      {/* — Accounts Section — */}
      <section>
        <SectionHeader label="Accounts" color="#5061F6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Accounts" value={snapshot.totalAccounts} format="integer" accent="#5061F6" />
          <KPICard label="Active Accounts" value={snapshot.activeAccounts} format="integer" accent="#49B697" />
          <KPICard label="Churned Accounts" value={snapshot.churnedAccounts} format="integer" accent="#ef4444" />
          <KPICard label="Overall Churn Rate" value={snapshot.overallChurnRate} format="percent" accent="#F4BF1D" />
        </div>

        {/* At-Risk Accounts Strip */}
        {atRiskAccounts.length > 0 && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} className="shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-xs font-bold text-red-600 uppercase tracking-widest">At-Risk Accounts (Health &lt; 40)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {atRiskAccounts.map((acc) => (
                <a
                  key={acc.accountId}
                  href={`/accounts/${acc.accountId}`}
                  className="inline-flex items-center gap-2 bg-white border border-red-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-400 hover:text-red-700 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {acc.accountName}
                  <span className="text-red-500 tabular-nums">{acc.score.toFixed(0)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* — Revenue Section — */}
      <section>
        <SectionHeader label="Revenue" color="#49B697" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KPICard label="Total MRR" value={snapshot.totalMRR} format="currency" accent="#49B697" />
          <KPICard label="Total ARR" value={snapshot.totalARR} format="currency" accent="#49B697" />
          <KPICard label="Total ACV" value={snapshot.acv} format="currency" subLabel="annualized contract value" accent="#49B697" />
          <KPICard label="Total Contract Value" value={snapshot.totalContractValue} format="currency" accent="#49B697" />
          <KPICard label="ARPA" value={snapshot.arpa} format="currency" subLabel="per active account" accent="#49B697" />
          <KPICard label="Avg ACV" value={snapshot.avgACV} format="currency" subLabel="per active contract" accent="#49B697" />
          <KPICard label="Avg MRR / Contract" value={snapshot.avgMRRPerContract} format="currency" subLabel="active contracts only" accent="#49B697" />
        </div>

        {/* MRR Composition Chart */}
        {chartData.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">MRR Composition — Last 3 Months</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<MRRChartTooltip />} cursor={{ fill: '#F5F2FF' }} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-600 font-medium">{v}</span>} />
                <Bar dataKey="New MRR"  stackId="mrr" fill="#5061F6"  radius={[0, 0, 0, 0]} />
                <Bar dataKey="Expansion" stackId="mrr" fill="#49B697"  radius={[0, 0, 0, 0]} />
                <Bar dataKey="Renewal"  stackId="mrr" fill="#C2B4FB"  radius={[0, 0, 0, 0]} />
                <Bar dataKey="Churned"  fill="#fca5a5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* — Operations — */}
      <section>
        <SectionHeader label="Operations" color="#F97316" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Open Tasks" value={snapshot.openTasksCount} format="integer" accent="#F97316" subLabel="across all accounts" />
          <KPICard label="Overdue Tasks" value={snapshot.overdueTasksCount} format="integer" accent="#ef4444" subLabel="past due date" />
        </div>
      </section>

      {/* — Efficiency & Ratios — */}
      <section>
        <SectionHeader label="Efficiency & Ratios" color="#F4BF1D" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KPICard label="NRR (Last Month)" value={snapshot.nrrLastMonth} format="percent" subLabel="net revenue retention" accent="#F4BF1D" />
          <KPICard label="NRR (Last Quarter)" value={snapshot.nrrLastQuarter} format="percent" subLabel="net revenue retention" accent="#F4BF1D" />
          <KPICard label="MRR per Branch" value={snapshot.mrrPerBranch} format="currency" accent="#F4BF1D" />
          <KPICard label="Avg Contract Duration" value={snapshot.avgContractDuration} format="integer" subLabel="months" accent="#F4BF1D" />
          <KPICard label="Total Contracts" value={snapshot.totalContracts} format="integer" accent="#F4BF1D" />
          <KPICard label="Active Contracts" value={snapshot.activeContracts} format="integer" accent="#F4BF1D" />
        </div>
      </section>

      {/* — Footprint — */}
      <section>
        <SectionHeader label="Footprint" color="#C2B4FB" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KPICard label="Countries Served" value={snapshot.countriesServed} format="integer" accent="#C2B4FB" />
          <KPICard label="Total Brands" value={snapshot.totalBrands} format="integer" accent="#C2B4FB" />
          <KPICard label="Total Branches" value={snapshot.totalBranches} format="integer" accent="#C2B4FB" />
        </div>
      </section>

      {/* Recent Performance */}
      <section>
        <SectionHeader label="Recent Performance" color="#5061F6" />
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-widest sticky left-0 bg-transparent whitespace-nowrap">Metric</th>
                {recentMonths.map((m) => (
                  <th key={m.label} className="px-5 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: 'New MRR Signed', key: 'newMRR', type: 'currency' },
                { label: 'Expansion MRR', key: 'expansionMRR', type: 'currency' },
                { label: 'Renewal MRR', key: 'renewalMRR', type: 'currency' },
                { label: 'Total MRR Signed', key: 'totalMRRSigned', type: 'currency', bold: true },
                { label: 'Churned MRR', key: 'churnedMRR', type: 'currency' },
                { label: 'Net New MRR', key: 'netNewMRR', type: 'currency', bold: true },
                { label: 'New Contracts', key: 'newContracts', type: 'number' },
                { label: 'Churned Contracts', key: 'churnedContracts', type: 'number' },
                { label: 'Contract Value', key: 'contractValue', type: 'currency' },
                { label: 'NRR', key: 'nrr', type: 'percent' },
                { label: 'GRR', key: 'grr', type: 'percent' },
              ].map((row) => (
                <tr key={row.key} className="hover:bg-[#F5F2FF]/40 transition-colors">
                  <td className={`px-5 py-3 sticky left-0 bg-white whitespace-nowrap ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {row.bold && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#5061F6] mr-2 mb-px" />}
                    {row.label}
                  </td>
                  {recentMonths.map((m, i) => {
                    const prev = recentMonths[i + 1] || priorMonth
                    const delta = prev && prev[row.key] ? (m[row.key] - prev[row.key]) / Math.abs(prev[row.key]) : null
                    return (
                      <td key={m.label} className="px-5 py-3 text-right">
                        <div className={`font-medium ${row.bold ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>{fmt(m[row.key], row.type)}</div>
                        {delta !== null && row.type !== 'percent' && <DeltaBadge value={delta} />}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-14 bg-gray-100 rounded-2xl w-full" />
      {[
        { n: 4, color: '#5061F6' },
        { n: 7, color: '#49B697' },
        { n: 2, color: '#F97316' },
        { n: 6, color: '#F4BF1D' },
        { n: 3, color: '#C2B4FB' },
      ].map(({ n, color }, si) => (
        <div key={si}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: color }} />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(n)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
          </div>
        </div>
      ))}
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  )
}
