'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'

export default function SalesLogPage() {
  const [search, setSearch] = useState('')

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['invoicing-deals'],
    queryFn: () => fetch('/api/invoicing/deals').then((r) => r.json()),
  })

  const displayed = useMemo(() => {
    if (!search.trim()) return deals
    const q = search.toLowerCase()
    return deals.filter(
      (d) =>
        d.accountName?.toLowerCase().includes(q) ||
        d.agent?.name?.toLowerCase().includes(q) ||
        d.countryCode?.toLowerCase().includes(q),
    )
  }, [deals, search])

  const columns = [
    {
      key: 'id',
      label: '#',
      render: (r) => <span className="text-xs text-gray-400 font-mono">#{r.id}</span>,
    },
    {
      key: 'startDate',
      label: 'Deal Date',
      render: (r) => new Date(r.startDate).toLocaleDateString(),
    },
    {
      key: 'accountName',
      label: 'Account',
      rtl: true,
      render: (r) => <span className="font-medium">{r.accountName}</span>,
    },
    {
      key: 'agent',
      label: 'Agent',
      render: (r) => r.agent?.name || r.agent?.email || '—',
    },
    {
      key: 'countryCode',
      label: 'Country',
      render: (r) => r.countryCode,
    },
    {
      key: 'package',
      label: 'Package',
      render: (r) => <Badge value={r.package} />,
    },
    {
      key: 'posSystem',
      label: 'POS',
      render: (r) => <Badge value={r.posSystem} />,
    },
    {
      key: 'paymentType',
      label: 'Payment',
      render: (r) => <Badge value={r.paymentType} />,
    },
    {
      key: 'totalMRR',
      label: 'MRR (excl. VAT)',
      render: (r) => `${r.countryCode} ${Number(r.totalMRR).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'contractValue',
      label: 'Contract Value',
      render: (r) => `${r.countryCode} ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'invoices',
      label: 'Invoices',
      sortable: false,
      render: (r) => (
        <span className="text-xs text-gray-500">
          {r.invoices?.length || 0} invoice{r.invoices?.length !== 1 ? 's' : ''}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Immutable record of all confirmed deals.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by account, agent, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white w-64"
        />
      </div>

      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      ) : (
        <DataTable columns={columns} data={displayed} exportFilename="sales-log.csv" />
      )}
    </div>
  )
}
