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

  // ── Pipeline Origin helpers ──
  const CHANNEL_LABELS = {
    Foodics: 'Foodics', EmployeeReferral: 'Employee Referral', CustomerReferral: 'Customer Referral',
    PartnerReferral: 'Partner Referral', Website: 'Website', AmbassadorReferral: 'Ambassador Referral',
    DirectSales: 'Direct Sales', Sonic: 'Sonic',
  }
  function pipelineDays(lead) {
    if (!lead?.convertedAt || !lead?.createdAt) return null
    return Math.round((new Date(lead.convertedAt) - new Date(lead.createdAt)) / 86400000)
  }

  // ── Deals columns ──
  const dealCols = [
    { key: 'id',                  label: '#',             render: (r) => <span className="text-gray-400 text-xs">#{r.id}</span> },
    { key: 'createdAt',           label: 'Date',          render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'accountName',         label: 'Account Name',  render: (r) => <span className="font-medium">{r.accountName}</span> },
    { key: 'package',             label: 'Package',       render: (r) => r.package || '—' },
    { key: 'contractValue',       label: 'Value (excl.)', render: (r) => r.contractValue != null ? `USD ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—' },
    { key: 'contractValueInclVAT',label: 'Value (incl.)', render: (r) => r.contractValueInclVAT != null ? `USD ${Number(r.contractValueInclVAT).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—' },
  ]

  const contractCols = [
    { key: 'type', label: 'Type', render: (r) => <Badge value={r.type} /> },
    { key: 'startDate', label: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', label: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'contractValue', label: 'Value', render: (r) => `USD ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { key: 'mrr', label: 'MRR', render: (r) => `USD ${(r.mrr || 0).toFixed(2)}` },
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
        <span className="text-sm text-gray-400">#{account.id} · {account.countryName || account.countryCode} · {account.leadSource?.replace(/([A-Z])/g, ' $1').trim()}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total MRR" value={account.totalMRR} format="currency" />
        <KPICard label="Contracts" value={account.contractCount} format="integer" />
        <KPICard label="Branches" value={account.numberOfBranches} format="integer" />
        <KPICard label="Brands" value={account.brands} format="integer" />
      </div>

      {/* Pipeline Origin */}
      {account.lead ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-700">🎯 Pipeline Origin</h3>
            <a href={`/pipeline`} className="text-xs text-indigo-500 hover:underline">View in Pipeline →</a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Channel</p>
              <p className="font-medium text-gray-700">{CHANNEL_LABELS[account.lead.channel] || account.lead.channel}</p>
            </div>
            {account.lead.estimatedValue && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Est. Value</p>
                <p className="font-medium text-gray-700">{Number(account.lead.estimatedValue).toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
              </div>
            )}
            {pipelineDays(account.lead) !== null && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Days to Close</p>
                <p className="font-medium text-gray-700">{pipelineDays(account.lead)} days</p>
              </div>
            )}
            {account.lead.convertedAt && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Converted</p>
                <p className="font-medium text-gray-700">{new Date(account.lead.convertedAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-400">No pipeline history linked to this account.</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Contracts</h3>
        <DataTable columns={contractCols} data={account.contracts || []} />
      </div>

      {/* Deals */}
      {account.deals && account.deals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Deals</h3>
          <DataTable columns={dealCols} data={account.deals} />
        </div>
      )}

      {/* Onboarding */}
      {account.onboarding && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-indigo-700">🚀 Onboarding</h3>
            <a href={`/onboarding/${account.onboarding.id}`} className="text-xs text-indigo-500 hover:underline">
              View tracker →
            </a>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Current Phase</p>
              <p className="font-medium text-gray-700">
                {account.onboarding.phase.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Phase Progress</p>
              <p className="font-medium text-gray-700">
                {account.onboarding.currentPhaseCompleted}/{account.onboarding.currentPhaseTasks} tasks
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Overall</p>
              <p className="font-medium text-gray-700">
                {account.onboarding.completedTasks}/{account.onboarding.totalTasks} tasks
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Started</p>
              <p className="font-medium text-gray-700">
                {new Date(account.onboarding.startDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
