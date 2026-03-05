'use client'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/DataTable'

function pct(v) { return v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—' }

export default function ChurnPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['churn'],
    queryFn: () => fetch('/api/analytics/churn').then((r) => r.json()),
  })

  const quarterCols = [
    { key: 'quarter', label: 'Quarter' },
    { key: 'activeAtStart', label: 'Active at Start', render: (r) => r.activeAtStart?.length ?? 0 },
    { key: 'newLogos', label: 'New Logos' },
    { key: 'churnedLogos', label: 'Churned Logos' },
    { key: 'logoChurnRate', label: 'Logo Churn Rate', render: (r) => pct(r.logoChurnRate) },
    { key: 'avgLifespan', label: 'Avg Lifespan (mo)', render: (r) => r.avgLifespan ? `${r.avgLifespan.toFixed(1)} mo` : '—' },
  ]

  const sourceCols = [
    { key: 'leadSource', label: 'Lead Source', render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'totalAccounts', label: 'Total' },
    { key: 'active', label: 'Active' },
    { key: 'churned', label: 'Churned' },
    { key: 'churnRate', label: 'Churn Rate', render: (r) => pct(r.churnRate) },
  ]

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-gray-200 rounded-2xl" /><div className="h-48 bg-gray-200 rounded-2xl" /></div>

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Logo Churn Rate by Quarter</h2>
        <DataTable columns={quarterCols} data={data?.byQuarter || []} exportFilename="churn-quarter.csv" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Churn by Lead Source</h2>
        <DataTable columns={sourceCols} data={data?.byLeadSource || []} exportFilename="churn-leadsource.csv" />
      </div>
    </div>
  )
}
