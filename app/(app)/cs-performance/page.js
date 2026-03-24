'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'
import { PageError } from '@/components/ui/PageError'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtScore(v) { return v !== null && v !== undefined ? v.toFixed(1) : '—' }

function HealthBar({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-300 text-xs">—</span>
  const pct = Math.round(value)
  const color = value >= 70 ? '#49B697' : value >= 40 ? '#F4BF1D' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right font-semibold" style={{ color }}>{pct}</span>
    </div>
  )
}

function ScoreDot({ score }) {
  if (score === null || score === undefined) return <span className="text-gray-300 text-xs">—</span>
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-500'
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Watch' : 'At Risk'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color.replace('bg-', 'text-').replace('-500', '-700').replace('-400', '-700')}`}>
      <span className={`w-2 h-2 rounded-full ${color} inline-block`} />{label}
    </span>
  )
}

function AccountRow({ acc }) {
  const daysSinceEngagement = acc.lastEngagedAt
    ? Math.floor((Date.now() - new Date(acc.lastEngagedAt).getTime()) / 86400000)
    : null

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5 text-gray-800 font-medium">
        {acc.accountId
          ? <a href={`/accounts/${acc.accountId}`} className="hover:text-indigo-600 hover:underline">{acc.accountName}</a>
          : acc.accountName}
      </td>
      <td className="px-4 py-2.5 text-xs">
        <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
          {acc.phase?.replace(/([A-Z])/g, ' $1').trim()}
        </span>
      </td>
      <td className="px-4 py-2.5 min-w-[140px]"><HealthBar value={acc.healthScore} /></td>
      <td className="px-4 py-2.5 text-gray-600 text-sm">{fmtScore(acc.avgCSAT)}</td>
      <td className="px-4 py-2.5 text-gray-600 text-sm">{fmtScore(acc.avgNPS)}</td>
      <td className="px-4 py-2.5 text-sm">
        {acc.totalTasks > 0 ? `${acc.completedTasks}/${acc.totalTasks}` : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2.5">
        {acc.overdueCount > 0
          ? <span className="inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold">{acc.overdueCount} late</span>
          : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-2.5 text-center text-sm">
        <span className={acc.engagements30d > 0 ? 'font-semibold text-indigo-600' : 'text-gray-300'}>
          {acc.engagements30d ?? 0}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
        {daysSinceEngagement === null
          ? <span className="text-gray-300">Never</span>
          : daysSinceEngagement === 0
            ? <span className="text-emerald-600 font-medium">Today</span>
            : daysSinceEngagement <= 7
              ? <span className="text-emerald-600">{daysSinceEngagement}d ago</span>
              : daysSinceEngagement <= 30
                ? <span className="text-amber-600">{daysSinceEngagement}d ago</span>
                : <span className="text-red-400">{daysSinceEngagement}d ago</span>}
      </td>
    </tr>
  )
}

function RepCard({ rep }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-base">{rep.userName}</span>
            <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
              {rep.userRole?.replace(/_/g, ' ')}
            </span>
            {rep.totalOverdueTasks > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                {rep.totalOverdueTasks} overdue
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{rep.userEmail}</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 whitespace-nowrap mt-1"
        >
          {open ? 'Hide accounts' : `View ${rep.accountsManaged} accounts`}
        </button>
      </div>

      {/* KPI row */}
      <div className="border-t border-gray-50 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 divide-x divide-gray-50">
        {[
          { label: 'Accounts',     value: rep.accountsManaged,  mono: true },
          { label: 'Avg Health',   render: () => <HealthBar value={rep.avgHealthScore} /> },
          { label: 'Healthy',      value: rep.accountsHealthy,  color: 'text-emerald-600' },
          { label: 'Watch',        value: rep.accountsWatch,    color: 'text-amber-500' },
          { label: 'At Risk',      value: rep.accountsAtRisk,   color: 'text-red-500' },
          { label: 'Avg CSAT',     value: fmtScore(rep.avgCSAT), mono: true },
          { label: 'Avg NPS',      value: fmtScore(rep.avgNPS),  mono: true },
          { label: 'Engagements',  value: fmt(rep.totalEngagements), mono: true },
          { label: 'Last 30 days', value: fmt(rep.engagements30d),   mono: true, color: rep.engagements30d > 0 ? 'text-indigo-600' : 'text-gray-400' },
        ].map(({ label, value, render, color, mono }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{label}</p>
            {render ? render() : (
              <p className={`text-sm font-bold ${color || 'text-gray-800'} ${mono ? 'tabular-nums' : ''}`}>
                {value ?? '—'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Account table */}
      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Account', 'Phase', 'Health', 'CSAT', 'NPS', 'Tasks', 'Overdue', '30d Eng.', 'Last Engaged'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rep.accounts
                .sort((a, b) => (a.healthScore ?? -1) - (b.healthScore ?? -1))
                .map((acc) => <AccountRow key={acc.accountId} acc={acc} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function exportRepsCsv(reps) {
  function cell(v) {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const headers = ['Name', 'Email', 'Role', 'Accounts', 'Avg Health', 'Healthy', 'Watch', 'At Risk', 'Avg CSAT', 'Avg NPS', 'Overdue Tasks']
  const rows = reps.map((r) => [
    r.userName, r.userEmail, r.userRole?.replace(/_/g, ' '),
    r.accountsManaged,
    r.avgHealthScore !== null ? Number(r.avgHealthScore).toFixed(1) : '',
    r.accountsHealthy, r.accountsWatch, r.accountsAtRisk,
    r.avgCSAT !== null ? Number(r.avgCSAT).toFixed(1) : '',
    r.avgNPS !== null ? Number(r.avgNPS).toFixed(1) : '',
    r.totalOverdueTasks,
  ].map(cell).join(','))
  const csv = [headers.map(cell).join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'cs-performance.csv'; a.click()
  URL.revokeObjectURL(a.href)
}

export default function CSPerformancePage() {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['cs-performance'],
    queryFn: () => fetch('/api/analytics/cs-performance').then((r) => {
      if (!r.ok) throw new Error('Failed to load CS performance data')
      return r.json()
    }),
    refetchInterval: 60_000,
  })

  const totalAccounts   = data.reduce((s, r) => s + r.accountsManaged, 0)
  const totalOverdue    = data.reduce((s, r) => s + r.totalOverdueTasks, 0)
  const avgHealth       = data.filter((r) => r.avgHealthScore !== null).length > 0
    ? data.filter((r) => r.avgHealthScore !== null).reduce((s, r) => s + r.avgHealthScore, 0) /
      data.filter((r) => r.avgHealthScore !== null).length : null
  const totalAtRisk     = data.reduce((s, r) => s + r.accountsAtRisk, 0)

  if (isError) return <PageError onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CS Rep Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Health scores, task completion, and account status per account manager.</p>
        </div>
        {data.length > 0 && (
          <button
            onClick={() => exportRepsCsv(data)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#5061F6] bg-white border border-[#5061F6]/20 rounded-lg hover:bg-[#F5F2FF] transition-colors shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" d="M12 3v13M7 11l5 5 5-5M3 21h18" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}</div>
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="CS Reps"        value={data.length}      format="integer" subLabel="with accounts" />
            <KPICard label="Accounts Managed" value={totalAccounts}  format="integer" subLabel="total" />
            <KPICard label="Avg Health"     value={avgHealth}        format="number"  subLabel="out of 100" />
            <KPICard label="At-Risk Accounts" value={totalAtRisk}    format="integer" subLabel={`${totalOverdue} overdue tasks`} accent="#ef4444" />
          </div>

          {data.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 text-center">
              <p className="text-sm text-gray-400">No account manager assignments found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.map((rep) => <RepCard key={rep.userId} rep={rep} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
