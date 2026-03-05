'use client'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/DataTable'

function sar(v) { return `SAR ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` }
function pct(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—' }

export default function RevenueQualityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['revenue-quality'],
    queryFn: () => fetch('/api/analytics/revenue-quality').then((r) => r.json()),
  })

  const concCols = [
    { key: 'rank', label: '#' },
    { key: 'name', label: 'Account', rtl: true },
    { key: 'mrr', label: 'MRR', render: (r) => sar(r.mrr) },
    { key: 'percentOfTotal', label: '% of MRR', render: (r) => pct(r.percentOfTotal) },
    { key: 'cumulativePercent', label: 'Cumulative %', render: (r) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-20">
          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (r.cumulativePercent || 0) * 100)}%` }} />
        </div>
        <span>{pct(r.cumulativePercent)}</span>
      </div>
    )},
  ]

  const mrrCols = [
    { key: 'quarter', label: 'Quarter' },
    { key: 'totalMRR', label: 'Total MRR', render: (r) => sar(r.totalMRR) },
    { key: 'activeAccounts', label: 'Active Accounts' },
    { key: 'avgMRRPerAccount', label: 'Avg MRR / Account', render: (r) => sar(r.avgMRRPerAccount) },
    { key: 'arr', label: 'ARR', render: (r) => sar(r.arr) },
  ]

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-gray-200 rounded-2xl" /><div className="h-48 bg-gray-200 rounded-2xl" /></div>

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue Concentration Risk (Pareto)</h2>
        <DataTable columns={concCols} data={data?.concentration || []} exportFilename="revenue-concentration.csv" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">MRR per Account by Quarter</h2>
        <DataTable columns={mrrCols} data={data?.mrrPerBranch || []} exportFilename="mrr-per-account.csv" />
      </div>
    </div>
  )
}
