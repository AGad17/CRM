'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ContractForm } from '@/components/forms/ContractForm'

export default function ContractsPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ type: '', year: '' })
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [cancelId, setCancelId] = useState(null)

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filters.type) p.set('type', filters.type)
      if (filters.year) p.set('year', filters.year)
      return fetch(`/api/contracts?${p}`).then((r) => r.json())
    },
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/contracts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['contracts']); qc.invalidateQueries(['dashboard']); setEditTarget(null) },
  })

  const cancel = useMutation({
    mutationFn: (id) => fetch(`/api/contracts/${id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancellationDate: new Date().toISOString() }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['contracts']); qc.invalidateQueries(['dashboard']); setCancelId(null) },
  })

  const years = [...new Set(contracts.map((c) => new Date(c.startDate).getFullYear()))].sort((a, b) => b - a)

  const displayed = useMemo(() => {
    if (!search.trim()) return contracts
    const q = search.toLowerCase()
    return contracts.filter((c) => c.account?.name?.toLowerCase().includes(q))
  }, [contracts, search])

  const columns = [
    { key: 'id', label: '#', render: (r) => <span className="text-xs text-gray-400 font-mono">#{r.id}</span>, getValue: (r) => r.id },
    { key: 'accountName', label: 'Account', rtl: true, render: (r) => <span className="font-medium">{r.account?.name}</span>, getValue: (r) => r.account?.name || '' },
    { key: 'country', label: 'Country', render: (r) => r.account?.countryCode, getValue: (r) => r.account?.countryCode || '' },
    { key: 'type', label: 'Type', render: (r) => <Badge value={r.type} />, getValue: (r) => r.type },
    { key: 'startDate', label: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString(), getValue: (r) => r.startDate ? new Date(r.startDate).toLocaleDateString('en-GB') : '' },
    { key: 'endDate', label: 'End', render: (r) => new Date(r.endDate).toLocaleDateString(), getValue: (r) => r.endDate ? new Date(r.endDate).toLocaleDateString('en-GB') : '' },
    {
      key: 'contractValue', label: 'Value',
      render: (r) => {
        const ccy = r.account?.currency || 'USD'
        return `${ccy} ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      },
      getValue: (r) => Number(r.contractValue || 0).toFixed(2),
    },
    {
      key: 'mrr', label: 'MRR',
      render: (r) => {
        const ccy = r.account?.currency || 'USD'
        return `${ccy} ${(r.mrr || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      },
      getValue: (r) => (r.mrr || 0).toFixed(2),
    },
    {
      key: 'usdRate', label: 'FX Rate',
      render: (r) => {
        if (!r.usdRate) return <span className="text-gray-300">—</span>
        const ccy = r.account?.currency || ''
        return (
          <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
            1 USD = {Number(r.usdRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {ccy}
          </span>
        )
      },
      getValue: (r) => r.usdRate ? Number(r.usdRate).toFixed(4) : '',
    },
    { key: 'contractStatus', label: 'Status', render: (r) => <Badge value={r.contractStatus} />, getValue: (r) => r.contractStatus },
    { key: 'churnFlag', label: 'Churn', render: (r) => <Badge value={r.churnFlag} />, getValue: (r) => r.churnFlag },
    { key: 'actions', label: '', sortable: false, exportable: false, render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => setEditTarget(r)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Edit</button>
        {r.churnFlag === 'Active' ? (
          <button onClick={() => setCancelId(r.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Cancel</button>
        ) : <span className="text-xs text-gray-300">Churned</span>}
      </div>
    )},
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">All Types</option>
          {['New', 'Renewal', 'Expansion'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search by account…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white w-52"
        />
        <div className="flex-1" />
      </div>

      {isLoading ? <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" /> : (
        <DataTable columns={columns} data={displayed} exportFilename="contracts.csv" />
      )}

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit Contract #${editTarget?.id}`}>
        {editTarget && (
          <ContractForm
            isEdit
            initial={editTarget}
            accounts={[]}
            products={products}
            onSubmit={(data) => update.mutate({ id: editTarget.id, data })}
            onCancel={() => setEditTarget(null)}
            loading={update.isPending}
          />
        )}
      </Modal>

      <Modal isOpen={!!cancelId} onClose={() => setCancelId(null)} title="Cancel Contract">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Are you sure you want to mark contract <strong>#{cancelId}</strong> as cancelled? This will set today as the cancellation date.</p>
          <div className="flex gap-3">
            <button onClick={() => cancel.mutate(cancelId)} disabled={cancel.isPending} className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
              {cancel.isPending ? 'Cancelling…' : 'Yes, Cancel'}
            </button>
            <button onClick={() => setCancelId(null)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
              Keep Active
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
