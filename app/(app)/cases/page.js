'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHANNEL_LABELS = {
  Whatsapp:        'WhatsApp',
  Call:            'Call',
  VirtualMeeting:  'Virtual Meeting',
  PhysicalMeeting: 'Physical Meeting',
  Email:           'Email',
  Other:           'Other',
}

export const OBJECTIVE_LABELS = {
  Inquiry:          'Inquiry',
  BugReport:        'Bug Report',
  TrainingRequest:  'Training Request',
  NewRequirement:   'New Requirement',
  TechnicalRequest: 'Technical Request',
  GlobalOutage:     'Global Outage',
}

export const STATUS_LABELS = {
  Open:             'Open',
  Resolved:         'Resolved',
  ClosedUnresolved: 'Closed – Unresolved',
  Escalated:        'Escalated',
}

export const STATUS_COLORS = {
  Open:             'bg-blue-50 text-blue-700',
  Resolved:         'bg-emerald-50 text-emerald-700',
  ClosedUnresolved: 'bg-gray-100 text-gray-500',
  Escalated:        'bg-orange-50 text-orange-700',
}

export const OBJECTIVE_COLORS = {
  Inquiry:          'bg-blue-50 text-blue-700',
  BugReport:        'bg-red-50 text-red-700',
  TrainingRequest:  'bg-amber-50 text-amber-700',
  NewRequirement:   'bg-indigo-50 text-indigo-700',
  TechnicalRequest: 'bg-violet-50 text-violet-700',
  GlobalOutage:     'bg-red-100 text-red-800',
}

function formatTTR(openedAt, resolvedAt) {
  if (!resolvedAt) return null
  const ms  = new Date(resolvedAt) - new Date(openedAt)
  const hrs = ms / (1000 * 60 * 60)
  if (hrs < 24) return `${Math.round(hrs)}h`
  const days = Math.floor(hrs / 24)
  const rem  = Math.round(hrs % 24)
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`
}

// ─── Create Case Modal ────────────────────────────────────────────────────────

function CaseModal({ accounts, staffUsers, onClose, onSave, prefillAccountId }) {
  const [form, setForm] = useState({
    accountId:    prefillAccountId || '',
    title:        '',
    channel:      '',
    objective:    '',
    description:  '',
    assignedToId: '',
    openedAt:     new Date().toISOString().split('T')[0],
  })
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return accounts
    return accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
  }, [accounts, search])

  const valid = form.title && form.channel && form.objective

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Open New Case</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Account */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account</label>
          <input
            type="text"
            placeholder="Search account…"
            value={search}
            onChange={e => { setSearch(e.target.value); setForm(f => ({ ...f, accountId: '' })) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && !form.accountId && (
            <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-40 bg-white shadow-sm">
              {filtered.slice(0, 20).map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, accountId: String(a.id) })); setSearch(a.name) }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-indigo-50"
                >
                  {a.name}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No accounts found</p>}
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Short summary of the issue…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Channel */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Channel <span className="text-red-500">*</span></label>
            <select
              value={form.channel}
              onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">Select…</option>
              {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {/* Objective */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objective <span className="text-red-500">*</span></label>
            <select
              value={form.objective}
              onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">Select…</option>
              {Object.entries(OBJECTIVE_LABELS).filter(([v]) => v !== 'GlobalOutage').map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Detailed notes about the issue…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Assigned To */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
            <select
              value={form.assignedToId}
              onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">— Unassigned —</option>
              {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>
          {/* Opened Date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Opened Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.openedAt}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, openedAt: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid}
            className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
          >
            Open Case
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const qc = useQueryClient()

  const [filters, setFilters] = useState({ status: '', objective: '', assignedToId: '', from: '', to: '' })
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(false)

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['cases', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => v && p.set(k, v))
      return fetch(`/api/cases?${p}`).then(r => r.json())
    },
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: () => fetch('/api/accounts?limit=1000').then(r => r.json()).then(d => d.accounts || d),
    staleTime: 5 * 60 * 1000,
  })

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetch('/api/users/staff').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body) =>
      fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => r.json()),
    onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['cases'] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/cases/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases'] }),
  })

  // Derived KPIs
  const kpis = useMemo(() => {
    const now   = new Date()
    const month = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      open:       cases.filter(c => c.status === 'Open').length,
      resolvedTM: cases.filter(c => c.status === 'Resolved' && new Date(c.resolvedAt) >= month).length,
      escalated:  cases.filter(c => c.status === 'Escalated').length,
      avgTTR: (() => {
        const resolved = cases.filter(c => c.resolvedAt)
        if (!resolved.length) return null
        const avgMs = resolved.reduce((s, c) => s + (new Date(c.resolvedAt) - new Date(c.openedAt)), 0) / resolved.length
        const hrs = avgMs / (1000 * 60 * 60)
        if (hrs < 24) return `${Math.round(hrs)}h`
        return `${(hrs / 24).toFixed(1)}d`
      })(),
    }
  }, [cases])

  const displayed = useMemo(() => {
    if (!search) return cases
    const q = search.toLowerCase()
    return cases.filter(c =>
      c.title?.toLowerCase().includes(q) ||
      c.account?.name?.toLowerCase().includes(q)
    )
  }, [cases, search])

  function clearFilters() {
    setFilters({ status: '', objective: '', assignedToId: '', from: '', to: '' })
    setSearch('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Cases</h2>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          + Open Case
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open Cases',         value: kpis.open,       color: 'text-blue-600' },
          { label: 'Resolved This Month', value: kpis.resolvedTM, color: 'text-emerald-600' },
          { label: 'Avg Time to Resolve', value: kpis.avgTTR ?? '—', color: 'text-indigo-600' },
          { label: 'Escalated',           value: kpis.escalated,  color: 'text-orange-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <p className="text-xs text-gray-400 mb-1">Search</p>
          <input
            type="text"
            placeholder="Title or account…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Status</p>
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Objective</p>
          <select
            value={filters.objective}
            onChange={e => setFilters(f => ({ ...f, objective: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">All Objectives</option>
            {Object.entries(OBJECTIVE_LABELS).filter(([v]) => v !== 'GlobalOutage').map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Assigned To</p>
          <select
            value={filters.assignedToId}
            onChange={e => setFilters(f => ({ ...f, assignedToId: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">All Staff</option>
            {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">From</p>
          <input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">To</p>
          <input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        {(search || Object.values(filters).some(Boolean)) && (
          <button onClick={clearFilters} className="text-xs text-indigo-500 hover:text-indigo-700 underline self-end pb-1.5">
            Clear all
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="animate-pulse h-64 bg-gray-50" />
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No cases found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['#', 'Title', 'Account', 'Objective', 'Status', 'Assigned To', 'Opened', 'TTR', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map(c => {
                  const ttr = formatTTR(c.openedAt, c.resolvedAt)
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/cases/${c.id}`}>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{c.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px] truncate">{c.title}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.account
                          ? <Link href={`/accounts/${c.account.id}`} onClick={e => e.stopPropagation()} className="text-indigo-600 hover:underline">{c.account.name}</Link>
                          : <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${OBJECTIVE_COLORS[c.objective] || 'bg-gray-50 text-gray-500'}`}>
                          {OBJECTIVE_LABELS[c.objective] || c.objective}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {c.assignedTo ? (c.assignedTo.name || c.assignedTo.email) : <span className="text-gray-300 italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(c.openedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {ttr || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm('Delete this case?')) deleteMutation.mutate(c.id) }}
                          className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && (
        <p className="text-xs text-gray-400 text-right">
          Showing {displayed.length} of {cases.length} cases
        </p>
      )}

      {/* Create Modal */}
      {modal && (
        <CaseModal
          accounts={accounts}
          staffUsers={staffUsers}
          onClose={() => setModal(false)}
          onSave={(form) => createMutation.mutate(form)}
        />
      )}
    </div>
  )
}
