'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ContractForm } from '@/components/forms/ContractForm'

export default function ContractsPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ type: '', year: '' })
  const [modal, setModal] = useState(null)
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

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetch('/api/accounts').then((r) => r.json()),
  })

  const create = useMutation({
    mutationFn: (data) => fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['contracts']); qc.invalidateQueries(['dashboard']); setModal(null) },
  })

  const cancel = useMutation({
    mutationFn: (id) => fetch(`/api/contracts/${id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancellationDate: new Date().toISOString() }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['contracts']); qc.invalidateQueries(['dashboard']); setCancelId(null) },
  })

  const years = [...new Set(contracts.map((c) => new Date(c.startDate).getFullYear()))].sort((a, b) => b - a)

  const columns = [
    { key: 'id', label: '#', render: (r) => <span className="text-xs text-gray-400 font-mono">#{r.id}</span> },
    { key: 'accountName', label: 'Account', rtl: true, render: (r) => <span className="font-medium">{r.account?.name}</span> },
    { key: 'country', label: 'Country', render: (r) => r.account?.country },
    { key: 'type', label: 'Type', render: (r) => <Badge value={r.type} /> },
    { key: 'startDate', label: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', label: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'contractValue', label: 'Value', render: (r) => `SAR ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { key: 'mrr', label: 'MRR', render: (r) => `SAR ${(r.mrr || 0).toFixed(2)}` },
    { key: 'contractStatus', label: 'Status', render: (r) => <Badge value={r.contractStatus} /> },
    { key: 'churnFlag', label: 'Churn', render: (r) => <Badge value={r.churnFlag} /> },
    { key: 'actions', label: '', sortable: false, render: (r) => (
      r.churnFlag === 'Active' ? (
        <button onClick={() => setCancelId(r.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Cancel</button>
      ) : <span className="text-xs text-gray-300">Churned</span>
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
        <div className="flex-1" />
        <a href="/api/export/csv?type=contracts" className="text-xs text-gray-500 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50">↓ Export</a>
        <button onClick={() => setModal('create')} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">+ New Contract</button>
      </div>

      {isLoading ? <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" /> : (
        <DataTable columns={columns} data={contracts} exportFilename="contracts.csv" />
      )}

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="New Contract">
        <ContractForm accounts={accounts} onSubmit={(data) => create.mutate(data)} onCancel={() => setModal(null)} loading={create.isPending} />
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
