'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'
import { DeltaBadge } from '@/components/ui/DeltaBadge'

function fmt(v, type = 'number') {
  if (v === null || v === undefined) return '—'
  if (type === 'currency') return `USD ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (type === 'percent') return `${(Number(v) * 100).toFixed(1)}%`
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

const SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']

export default function DashboardPage() {
  const [filters, setFilters] = useState({ country: '', leadSource: '' })

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filters.country) p.set('country', filters.country)
      if (filters.leadSource) p.set('leadSource', filters.leadSource)
      return fetch(`/api/analytics/dashboard?${p}`).then((r) => r.json())
    },
  })

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <div className="text-red-500 text-sm">Failed to load dashboard</div>

  const { snapshot, recentMonths, priorMonth } = data

  return (
    <div className="space-y-8">
      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
          value={filters.country}
          onChange={(e) => setFilters({ ...filters, country: e.target.value })}
        >
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
          value={filters.leadSource}
          onChange={(e) => setFilters({ ...filters, leadSource: e.target.value })}
        >
          <option value="">All Lead Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/([A-Z])/g, ' $1').trim()}</option>)}
        </select>
        {filters.country && (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
            {countries.find((c) => c.code === filters.country)?.name || filters.country}
            <button className="ml-1.5 hover:text-indigo-900" onClick={() => setFilters({ ...filters, country: '' })}>✕</button>
          </span>
        )}
        {filters.leadSource && (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
            {filters.leadSource.replace(/([A-Z])/g, ' $1').trim()}
            <button className="ml-1.5 hover:text-indigo-900" onClick={() => setFilters({ ...filters, leadSource: '' })}>✕</button>
          </span>
        )}
      </div>

      {/* — Accounts Section — */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Accounts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Accounts" value={snapshot.totalAccounts} format="integer" />
          <KPICard label="Active Accounts" value={snapshot.activeAccounts} format="integer" />
          <KPICard label="Churned Accounts" value={snapshot.churnedAccounts} format="integer" />
          <KPICard label="Overall Churn Rate" value={snapshot.overallChurnRate} format="percent" />
        </div>
      </section>

      {/* — Revenue Section — */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KPICard label="Total MRR" value={snapshot.totalMRR} format="currency" />
          <KPICard label="Total ARR" value={snapshot.totalARR} format="currency" />
          <KPICard label="Total ACV" value={snapshot.acv} format="currency" subLabel="annualized contract value" />
          <KPICard label="Total Contract Value" value={snapshot.totalContractValue} format="currency" />
          <KPICard label="ARPA" value={snapshot.arpa} format="currency" subLabel="per active account" />
          <KPICard label="Avg ACV" value={snapshot.avgACV} format="currency" subLabel="per active contract" />
          <KPICard label="Avg MRR / Contract" value={snapshot.avgMRRPerContract} format="currency" subLabel="active contracts only" />
        </div>
      </section>

      {/* — Efficiency & Ratios — */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Efficiency & Ratios</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KPICard label="NRR (Last Month)" value={snapshot.nrrLastMonth} format="percent" subLabel="net revenue retention" />
          <KPICard label="NRR (Last Quarter)" value={snapshot.nrrLastQuarter} format="percent" subLabel="net revenue retention" />
          <KPICard label="MRR per Branch" value={snapshot.mrrPerBranch} format="currency" />
          <KPICard label="Avg Contract Duration" value={snapshot.avgContractDuration} format="integer" subLabel="months" />
          <KPICard label="Total Contracts" value={snapshot.totalContracts} format="integer" />
          <KPICard label="Active Contracts" value={snapshot.activeContracts} format="integer" />
        </div>
      </section>

      {/* — Footprint — */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Footprint</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KPICard label="Countries Served" value={snapshot.countriesServed} format="integer" />
          <KPICard label="Total Brands" value={snapshot.totalBrands} format="integer" />
          <KPICard label="Total Branches" value={snapshot.totalBranches} format="integer" />
        </div>
      </section>

      {/* Recent Performance */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Performance</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50">Metric</th>
                {recentMonths.map((m) => (
                  <th key={m.label} className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{m.label}</th>
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
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className={`px-5 py-3 sticky left-0 bg-white whitespace-nowrap ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</td>
                  {recentMonths.map((m, i) => {
                    const prev = recentMonths[i + 1] || priorMonth
                    const delta = prev && prev[row.key] ? (m[row.key] - prev[row.key]) / Math.abs(prev[row.key]) : null
                    return (
                      <td key={m.label} className="px-5 py-3 text-right">
                        <div className={`font-medium ${row.bold ? 'text-gray-900' : 'text-gray-700'}`}>{fmt(m[row.key], row.type)}</div>
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
      <div className="h-10 bg-gray-100 rounded-xl w-64" />
      {[4, 5, 5, 3].map((n, si) => (
        <div key={si}>
          <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
          <div className={`grid grid-cols-${n} gap-4`}>
            {[...Array(n)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      ))}
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  )
}
