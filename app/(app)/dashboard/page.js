'use client'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'
import { DeltaBadge } from '@/components/ui/DeltaBadge'

function fmt(v, type = 'number') {
  if (v === null || v === undefined) return '—'
  if (type === 'currency') return `SAR ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (type === 'percent') return `${(Number(v) * 100).toFixed(1)}%`
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/analytics/dashboard').then((r) => r.json()),
  })

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <div className="text-red-500 text-sm">Failed to load dashboard</div>

  const { snapshot, recentMonths, priorMonth } = data

  return (
    <div className="space-y-8">
      {/* Snapshot KPI Grid */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">All-Time Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KPICard label="Total Accounts" value={snapshot.totalAccounts} format="integer" />
          <KPICard label="Active Accounts" value={snapshot.activeAccounts} format="integer" />
          <KPICard label="Churned Accounts" value={snapshot.churnedAccounts} format="integer" />
          <KPICard label="Overall Churn Rate" value={snapshot.overallChurnRate} format="percent" />
          <KPICard label="Total Contracts" value={snapshot.totalContracts} format="integer" />
          <KPICard label="Active Contracts" value={snapshot.activeContracts} format="integer" />
          <KPICard label="Total MRR" value={snapshot.totalMRR} format="currency" />
          <KPICard label="Total ARR" value={snapshot.totalARR} format="currency" />
          <KPICard label="Total Contract Value" value={snapshot.totalContractValue} format="currency" />
          <KPICard label="Avg MRR / Contract" value={snapshot.avgMRRPerContract} format="currency" />
          <KPICard label="Countries Served" value={snapshot.countriesServed} format="integer" />
          <KPICard label="Total Brands" value={snapshot.totalBrands} format="integer" />
          <KPICard label="Total Branches" value={snapshot.totalBranches} format="integer" />
        </div>
      </section>

      {/* Recent Performance */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Performance</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Metric</th>
                {recentMonths.map((m) => (
                  <th key={m.label} className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{m.label}</th>
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
                  <td className={`px-5 py-3 text-gray-700 ${row.bold ? 'font-semibold' : ''}`}>{row.label}</td>
                  {recentMonths.map((m, i) => {
                    const prev = recentMonths[i + 1] || priorMonth
                    const delta = prev ? (m[row.key] - prev[row.key]) / Math.abs(prev[row.key] || 1) : null
                    return (
                      <td key={m.label} className="px-5 py-3 text-right">
                        <div className={`font-medium ${row.bold ? 'text-gray-900' : 'text-gray-700'}`}>{fmt(m[row.key], row.type)}</div>
                        {delta !== null && <DeltaBadge value={delta} />}
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
      <div className="grid grid-cols-5 gap-4">
        {[...Array(13)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  )
}
