'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'

export default function AccountDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => fetch(`/api/accounts/${id}`).then((r) => r.json()),
  })

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
  if (!account || account.error) return <div className="text-red-500">Account not found</div>

  const contractCols = [
    { key: 'type', label: 'Type', render: (r) => <Badge value={r.type} /> },
    { key: 'startDate', label: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', label: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'contractValue', label: 'Value', render: (r) => `SAR ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { key: 'mrr', label: 'MRR', render: (r) => `SAR ${(r.mrr || 0).toFixed(2)}` },
    { key: 'contractStatus', label: 'Status', render: (r) => <Badge value={r.contractStatus} /> },
    { key: 'churnFlag', label: 'Churn', render: (r) => <Badge value={r.churnFlag} /> },
    { key: 'cancellationDate', label: 'Cancelled', render: (r) => r.cancellationDate ? new Date(r.cancellationDate).toLocaleDateString() : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-700">← Back</button>
        <h2 className="text-xl font-bold text-gray-900">{account.name}</h2>
        <Badge value={account.status} />
        <span className="text-sm text-gray-400">#{account.id} · {account.country} · {account.leadSource?.replace(/([A-Z])/g, ' $1').trim()}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total MRR" value={account.totalMRR} format="currency" />
        <KPICard label="Contracts" value={account.contractCount} format="integer" />
        <KPICard label="Branches" value={account.numberOfBranches} format="integer" />
        <KPICard label="Brands" value={account.brands} format="integer" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Contracts</h3>
        <DataTable columns={contractCols} data={account.contracts || []} />
      </div>
    </div>
  )
}
