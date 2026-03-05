'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { AccountForm } from '@/components/forms/AccountForm'

const COUNTRIES = ['', 'KSA', 'Egypt', 'UAE', 'Bahrain', 'Jordan']
const SOURCES = ['', 'Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']

export default function AccountsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ country: '', leadSource: '' })
  const [modal, setModal] = useState(null) // 'create' | { edit: account }

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filters.country) p.set('country', filters.country)
      if (filters.leadSource) p.set('leadSource', filters.leadSource)
      return fetch(`/api/accounts?${p}`).then((r) => r.json())
    },
  })

  const create = useMutation({
    mutationFn: (data) => fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['accounts']); setModal(null) },
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['accounts']); setModal(null) },
  })

  const columns = [
    { key: 'id', label: 'Code', render: (r) => <span className="font-mono text-xs text-gray-400">#{r.id}</span> },
    { key: 'name', label: 'Account Name', rtl: true, render: (r) => <button onClick={() => router.push(`/accounts/${r.id}`)} className="font-medium text-indigo-600 hover:underline text-left">{r.name}</button> },
    { key: 'country', label: 'Country' },
    { key: 'leadSource', label: 'Lead Source', render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'numberOfBranches', label: 'Branches' },
    { key: 'contractCount', label: 'Contracts' },
    { key: 'totalMRR', label: 'Total MRR', render: (r) => `SAR ${(r.totalMRR || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
    { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'churnDate', label: 'Churn Date', render: (r) => r.churnDate ? new Date(r.churnDate).toLocaleDateString() : '—' },
    { key: 'actions', label: '', sortable: false, render: (r) => (
      <button onClick={() => setModal({ edit: r })} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Edit</button>
    )},
  ]

  return (
    <div className="space-y-5">
      {/* Filters + Create */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c || 'All Countries'}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" value={filters.leadSource} onChange={(e) => setFilters({ ...filters, leadSource: e.target.value })}>
          {SOURCES.map((s) => <option key={s} value={s}>{s ? s.replace(/([A-Z])/g, ' $1').trim() : 'All Lead Sources'}</option>)}
        </select>
        <div className="flex-1" />
        <a href="/api/export/csv?type=accounts" className="text-xs text-gray-500 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50">↓ Export</a>
        <button onClick={() => setModal('create')} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">+ New Account</button>
      </div>

      {isLoading ? <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" /> : (
        <DataTable columns={columns} data={accounts} exportFilename="accounts.csv" />
      )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Account' : 'New Account'}>
        <AccountForm
          initial={modal?.edit || {}}
          onSubmit={(data) => modal?.edit ? update.mutate({ id: modal.edit.id, data }) : create.mutate(data)}
          onCancel={() => setModal(null)}
          loading={create.isPending || update.isPending}
        />
      </Modal>
    </div>
  )
}
