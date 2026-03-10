'use client'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ARSection({ title, data, color }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Invoiced"  value={fmt(data.total)}       subLabel={`${data.countPending + data.countEligible + data.countCollected} invoices`} />
        <KPICard label="Pending"         value={fmt(data.pending)}      subLabel={`${data.countPending} invoices`} />
        <KPICard label="Eligible"        value={fmt(data.eligible)}     subLabel={`${data.countEligible} invoices`} />
        <KPICard label="Collected"       value={fmt(data.collected)}    subLabel={`${data.countCollected} invoices`} />
        <KPICard label="Outstanding"     value={fmt(data.outstanding)}  subLabel="Pending + Eligible" />
        <KPICard label="Overdue"         value={fmt(data.overdue)}      subLabel={`${data.countOverdue} overdue`} />
      </div>
    </div>
  )
}

export default function ARReportPage() {
  const { data: report, isLoading } = useQuery({
    queryKey: ['invoicing-ar-report'],
    queryFn: () => fetch('/api/invoicing/ar-report').then((r) => r.json()),
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AR Report</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live accounts receivable summary across all channels.</p>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
          <ARSection title="All Channels"   data={report?.all}     color="bg-indigo-500" />
          <ARSection title="Foodics"        data={report?.foodics} color="bg-emerald-500" />
          <ARSection title="Direct (Geidea / Sonic)" data={report?.direct}  color="bg-orange-500" />
        </div>
      )}
    </div>
  )
}
