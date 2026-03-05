'use client'
import { useState, useMemo } from 'react'
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
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)       // 'create' | { edit: account }
  const [churnTarget, setChurnTarget] = useState(null) // account row to churn

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

  const churn = useMutation({
    mutationFn: (id) => fetch(`/api/accounts/${id}/churn`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries(['accounts'])
      qc.invalidateQueries(['dashboard'])
      setChurnTarget(null)
    },
  })

  const displayed = useMemo(() => {
    if (!search.trim()) return accounts
    const q = search.toLowerCase()
    return accounts.filter((a) => a.name?.toLowerCase().includes(q) || a.countryCode?.toLowerCase().includes(q))
  }, [accounts, search])

  // Compute impact figures for the churn confirmation modal
  const activeContracts = churnTarget
    ? (churnTarget.contracts || []).filter((c) => !c.cancellationDate)
    : []
  const lostDealValue = activeContracts.reduce((s, c) => s + Number(c.contractValue || 0), 0)
  const lostMRR = churnTarget?.totalMRR || 0

  const columns = [
    { key: 'id', label: 'Code', render: (r) => <span className="font-mono text-xs text-gray-400">#{r.id}</span> },
    { key: 'name', label: 'Account Name', rtl: true, render: (r) => <button onClick={() => router.push(`/accounts/${r.id}`)} className="font-medium text-indigo-600 hover:underline text-left">{r.name}</button> },
    { key: 'countryCode', label: 'Country' },
    { key: 'leadSource', label: 'Lead Source', render: (r) => r.leadSource?.replace(/([A-Z])/g, ' $1').trim() },
    { key: 'numberOfBranches', label: 'Branches' },
    { key: 'contractCount', label: 'Contracts' },
    { key: 'totalMRR', label: 'Total MRR', render: (r) => `USD ${(r.totalMRR || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
    { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'churnDate', label: 'Churn Date', render: (r) => r.churnDate ? new Date(r.churnDate).toLocaleDateString() : '—' },
    { key: 'actions', label: '', sortable: false, render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => setModal({ edit: r })} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Edit</button>
        {r.status !== 'Churned' && (
          <button
            onClick={() => setChurnTarget(r)}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 font-medium"
          >
            Churn
          </button>
        )}
      </div>
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
        <input
          type="text"
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white w-52"
        />
        <div className="flex-1" />
        <a href="/api/export/csv?type=accounts" className="text-xs text-gray-500 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50">↓ Export</a>
        <button onClick={() => setModal('create')} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">+ New Account</button>
      </div>

      {isLoading ? <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" /> : (
        <DataTable columns={columns} data={displayed} exportFilename="accounts.csv" />
      )}

      {/* Edit / Create modal */}
      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Account' : 'New Account'}>
        <AccountForm
          initial={modal?.edit || {}}
          onSubmit={(data) => modal?.edit ? update.mutate({ id: modal.edit.id, data }) : create.mutate(data)}
          onCancel={() => setModal(null)}
          loading={create.isPending || update.isPending}
        />
      </Modal>

      {/* Churn confirmation modal */}
      <Modal isOpen={!!churnTarget} onClose={() => setChurnTarget(null)} title="Churn Account">
        {churnTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You are about to churn <strong>{churnTarget.name}</strong>. This will cancel{' '}
              <strong>{activeContracts.length} active contract{activeContracts.length !== 1 ? 's' : ''}</strong>{' '}
              and set today as the cancellation date.
            </p>

            {/* Impact summary */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-1">Lost MRR</p>
                <p className="text-xl font-bold text-red-700">
                  USD {lostMRR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-1">Cancelled Deal Value</p>
                <p className="text-xl font-bold text-red-700">
                  USD {lostDealValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400">This action cannot be undone from this screen.</p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => churn.mutate(churnTarget.id)}
                disabled={churn.isPending}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {churn.isPending ? 'Churning…' : 'Yes, Churn Account'}
              </button>
              <button
                onClick={() => setChurnTarget(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
