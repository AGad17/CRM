'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OBJECTIVE_LABELS, STATUS_LABELS, STATUS_COLORS, OBJECTIVE_COLORS } from '../page'

function formatTTR(openedAt, resolvedAt) {
  if (!resolvedAt) return null
  const ms  = new Date(resolvedAt) - new Date(openedAt)
  const hrs = ms / (1000 * 60 * 60)
  if (hrs < 24) return `${Math.round(hrs)}h`
  const days = Math.floor(hrs / 24)
  const rem  = Math.round(hrs % 24)
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CaseReportPage() {
  const [filters, setFilters] = useState({ status: '', objective: '', assignedToId: '', from: '', to: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['cases-report', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => v && p.set(k, v))
      return fetch(`/api/cases/report?${p}`).then(r => r.json())
    },
  })

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetch('/api/users/staff').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const cases = data?.cases || []
  const stats = data?.stats || {}

  function clearFilters() {
    setFilters({ status: '', objective: '', assignedToId: '', from: '', to: '' })
  }

  function exportCsv() {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v))
    p.set('format', 'csv')
    window.location.href = `/api/cases/report?${p}`
  }

  const avgTTRLabel = useMemo(() => {
    if (stats.avgTTRHours == null) return '—'
    const h = stats.avgTTRHours
    if (h < 24) return `${Math.round(h)}h`
    return `${(h / 24).toFixed(1)}d`
  }, [stats.avgTTRHours])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Case Engagement Report</h2>
        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Cases',      value: stats.total          ?? '—', color: 'text-gray-800' },
          { label: 'Open',             value: stats.openCount       ?? '—', color: 'text-blue-600' },
          { label: 'Resolved',         value: stats.resolvedThisMonth ?? '—', color: 'text-emerald-600', sub: 'this month' },
          { label: 'Avg Time to Resolve', value: avgTTRLabel,            color: 'text-indigo-600' },
          { label: 'Resolution Rate',  value: stats.resolutionRate != null ? `${stats.resolutionRate}%` : '—', color: 'text-violet-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            {k.sub && <p className="text-xs text-gray-400">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-end gap-3">
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
            {Object.entries(OBJECTIVE_LABELS).filter(([v]) => ['BugReport','TechnicalRequest','NewRequirement'].includes(v)).map(([v, l]) => (
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
        {Object.values(filters).some(Boolean) && (
          <button onClick={clearFilters} className="text-xs text-indigo-500 hover:text-indigo-700 underline self-end pb-1.5">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="animate-pulse h-64 bg-gray-50" />
        ) : cases.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No cases match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['#', 'Title', 'Account', 'Objective', 'Status', 'Assigned To', 'Opened', 'Resolved', 'TTR'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cases.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{c.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">
                      <a href={`/cases/${c.id}`} className="hover:text-indigo-600 hover:underline">{c.title}</a>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.account?.name || <span className="text-gray-300">—</span>}</td>
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
                    <td className="px-4 py-3 text-gray-600">
                      {c.assignedTo ? (c.assignedTo.name || c.assignedTo.email) : <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(c.openedAt)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.resolvedAt ? fmtDate(c.resolvedAt) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatTTR(c.openedAt, c.resolvedAt) || <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && (
        <p className="text-xs text-gray-400 text-right">{cases.length} cases</p>
      )}
    </div>
  )
}
