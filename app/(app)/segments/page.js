'use client'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/DataTable'

function pct(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—' }
function sar(v) { return `USD ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` }

export default function SegmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['segments'],
    queryFn: () => fetch('/api/analytics/segments').then((r) => r.json()),
  })

  const countryCols = [
    { key: 'country', label: 'Country' },
    { key: 'totalMRR', label: 'Total MRR', render: (r) => sar(r.totalMRR) },
    { key: 'contracts', label: 'Contracts' },
    { key: 'contractValue', label: 'Contract Value', render: (r) => sar(r.contractValue) },
    { key: 'activeAccounts', label: 'Active' },
    { key: 'churnedAccounts', label: 'Churned' },
    { key: 'churnRate', label: 'Churn Rate', render: (r) => pct(r.churnRate) },
    { key: 'percentOfTotalMRR', label: '% of MRR', render: (r) => pct(r.percentOfTotalMRR) },
  ]

  const sourceCols = [
    { key: 'leadSource', label: 'Lead Source', render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'total', label: 'Total' },
    { key: 'active', label: 'Active' },
    { key: 'churned', label: 'Churned' },
    { key: 'churnRate', label: 'Churn Rate', render: (r) => pct(r.churnRate) },
    { key: 'percentOfTotal', label: '% of Total', render: (r) => pct(r.percentOfTotal) },
  ]

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue by Country</h2>
        <DataTable columns={countryCols} data={data?.byCountry || []} exportFilename="segments-country.csv" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Accounts by Lead Source</h2>
        <DataTable columns={sourceCols} data={data?.byLeadSource || []} exportFilename="segments-leadsource.csv" />
      </div>
    </div>
  )
}
