'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'
import { LeadSourceFilter } from '@/components/ui/LeadSourceFilter'
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter'

// ─── Phase definitions ────────────────────────────────────────────────────────

const PHASES = [
  {
    key:   'DealClosure',
    label: 'Deal Closure',
    team:  'Sales / AM',
    icon:  '🤝',
    light: 'bg-sky-50 border-sky-200',
    text:  'text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
    bar:   'bg-sky-500',
  },
  {
    key:   'Onboarding',
    label: 'Onboarding',
    team:  'Onboarding',
    icon:  '🏗️',
    light: 'bg-yellow-50 border-yellow-200',
    text:  'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    bar:   'bg-yellow-500',
  },
  {
    key:   'Training',
    label: 'Training',
    team:  'Onboarding',
    icon:  '📚',
    light: 'bg-purple-50 border-purple-200',
    text:  'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    bar:   'bg-purple-500',
  },
  {
    key:   'Incubation',
    label: 'Incubation',
    team:  'Onboarding',
    icon:  '🔍',
    light: 'bg-orange-50 border-orange-200',
    text:  'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
    bar:   'bg-orange-500',
  },
  {
    key:   'AccountManagement',
    label: 'Account Mgmt',
    team:  'Customer Success',
    icon:  '⭐',
    light: 'bg-green-50 border-green-200',
    text:  'text-green-700',
    badge: 'bg-green-100 text-green-700',
    bar:   'bg-green-500',
  },
  {
    key:   'Expired',
    label: 'Expired',
    team:  'Customer Success',
    icon:  '⏰',
    light: 'bg-amber-50 border-amber-200',
    text:  'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    bar:   'bg-amber-500',
  },
  {
    key:   'Churned',
    label: 'Churned',
    team:  '—',
    icon:  '🚫',
    light: 'bg-gray-50 border-gray-200',
    text:  'text-gray-500',
    badge: 'bg-gray-100 text-gray-500',
    bar:   'bg-gray-400',
  },
]

// ─── Go-Live Urgency Helper ───────────────────────────────────────────────────

const PRE_LIVE_PHASES = new Set(['DealClosure', 'Onboarding', 'Training', 'Incubation'])

function goLiveStatus(tracker) {
  if (!tracker.goLiveDate || !PRE_LIVE_PHASES.has(tracker.phase)) return null
  const daysUntil = Math.ceil((new Date(tracker.goLiveDate) - Date.now()) / 86400000)
  if (daysUntil < 0)  return { type: 'overdue', days: Math.abs(daysUntil) }
  if (daysUntil <= 7) return { type: 'urgent',  days: daysUntil }
  return { type: 'ok', date: new Date(tracker.goLiveDate).toLocaleDateString('en-GB') }
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function TrackerCard({ tracker, phase, onClick }) {
  const phasePct = tracker.currentPhaseTasks > 0
    ? Math.round((tracker.currentPhaseCompleted / tracker.currentPhaseTasks) * 100)
    : 0

  const daysCls =
    tracker.daysInPhase > 14 ? 'bg-red-100 text-red-600' :
    tracker.daysInPhase > 7  ? 'bg-amber-100 text-amber-600' :
                               'bg-gray-100 text-gray-500'

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer space-y-2.5"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="font-semibold text-sm text-gray-900 leading-tight truncate">
          {tracker.account?.name || '—'}
        </p>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {tracker.overdueCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              {tracker.overdueCount} late
            </span>
          )}
          {!tracker.accountManagerId && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">
              ⚠ No AM
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 truncate">
          {tracker.account?.country?.name || '—'}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tracker.accountMRR > 0 && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              ${Math.round(tracker.accountMRR).toLocaleString('en-US')}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${daysCls}`}>
            {tracker.daysInPhase}d
          </span>
        </div>
      </div>

      {(tracker.deal?.package || tracker.deal?.posSystem) && (
        <div className="flex flex-wrap gap-1">
          {tracker.deal?.package && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
              {tracker.deal.package}
            </span>
          )}
          {tracker.deal?.posSystem && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {tracker.deal.posSystem}
            </span>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Stage tasks</span>
          <span className="text-xs text-gray-500 font-medium">
            {tracker.currentPhaseCompleted}/{tracker.currentPhaseTasks}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${phasePct === 100 ? 'bg-green-500' : phase.bar}`}
            style={{ width: `${phasePct}%` }}
          />
        </div>
      </div>

      {(() => {
        const s = goLiveStatus(tracker)
        if (!s) return null
        if (s.type === 'overdue') return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            ⚠ Go-live {s.days}d overdue
          </span>
        )
        if (s.type === 'urgent') return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            ⏳ Go-live in {s.days}d
          </span>
        )
        return <span className="text-xs text-gray-400">Go-live {s.date}</span>
      })()}
      <p className="text-xs text-gray-300">
        Started {new Date(tracker.startDate).toLocaleDateString('en-GB')}
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [view,        setView]        = useState('kanban')
  const [phase,       setPhase]       = useState('')
  const [search,      setSearch]      = useState('')
  const [leadSources, setLeadSources] = useState([])
  const [csReps_f,    setCsReps_f]    = useState([])
  const [syncMsg,     setSyncMsg]     = useState(null)

  const { data: trackers = [], isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn:  () => fetch('/api/onboarding').then((r) => r.json()),
  })

  const seedMutation = useMutation({
    mutationFn: () => fetch('/api/onboarding/seed', { method: 'POST' }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      const msgs = []
      if (data.created      > 0) msgs.push(`added ${data.created} new account${data.created !== 1 ? 's' : ''}`)
      if (data.expiredSynced > 0) msgs.push(`moved ${data.expiredSynced} to Expired`)
      setSyncMsg(msgs.length > 0 ? `✓ ${msgs.map(m => m[0].toUpperCase() + m.slice(1)).join(', ')}.` : '✓ All accounts are already synced.')
      setTimeout(() => setSyncMsg(null), 5000)
    },
  })

  // Unique CS reps derived from loaded trackers
  const csReps = [...new Map(
    trackers
      .filter((t) => t.accountManager)
      .map((t) => [t.accountManager.id, t.accountManager])
  ).values()].sort((a, b) => a.name.localeCompare(b.name))

  // baseFiltered = all active filters except phase (used for score cards)
  const baseFiltered = trackers.filter((t) => {
    if (search && !t.account?.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (leadSources.length > 0 && !leadSources.includes(t.account?.leadSource)) return false
    if (csReps_f.length && !csReps_f.includes(t.accountManager?.id)) return false
    return true
  })

  // filtered = baseFiltered + phase filter (used for kanban / list content)
  const filtered = baseFiltered.filter((t) => !phase || t.phase === phase)

  const columns = [
    {
      key: 'account', label: 'Account', sortable: true,
      render: (r) => <span className="font-medium text-gray-900">{r.account?.name || '—'}</span>,
    },
    {
      key: 'phase', label: 'Stage',
      render: (r) => {
        const p = PHASES.find((x) => x.key === r.phase)
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${p?.badge || 'bg-gray-100 text-gray-600'}`}>
            {p?.icon} {r.phaseLabel}
          </span>
        )
      },
    },
    {
      key: 'team', label: 'Responsible Team',
      render: (r) => <span className="text-xs text-gray-500">{r.phaseTeam}</span>,
    },
    {
      key: 'progress', label: 'Stage Progress',
      render: (r) => {
        const pct = r.currentPhaseTasks > 0
          ? Math.round((r.currentPhaseCompleted / r.currentPhaseTasks) * 100) : 0
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 bg-gray-100 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {r.currentPhaseCompleted}/{r.currentPhaseTasks}
            </span>
          </div>
        )
      },
    },
    {
      key: 'started', label: 'Started', sortable: true,
      render: (r) => new Date(r.startDate).toLocaleDateString('en-GB'),
    },
    {
      key: 'goLive', label: 'Go-Live', sortable: true,
      render: (r) => {
        if (!r.goLiveDate) return <span className="text-gray-300">—</span>
        const s = goLiveStatus(r)
        const fmtDate = new Date(r.goLiveDate).toLocaleDateString('en-GB')
        if (!s)                 return <span className="text-gray-500">{fmtDate}</span>
        if (s.type === 'overdue') return <span className="font-semibold text-red-600">{fmtDate} ⚠</span>
        if (s.type === 'urgent')  return <span className="font-semibold text-amber-600">{fmtDate} ⏳</span>
        return <span className="text-gray-600">{fmtDate}</span>
      },
    },
    {
      key: 'daysInPhase', label: 'Days in Stage', sortable: true,
      render: (r) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          r.daysInPhase > 14 ? 'bg-red-100 text-red-600' :
          r.daysInPhase > 7  ? 'bg-amber-100 text-amber-600' : 'text-gray-500'
        }`}>
          {r.daysInPhase}d
        </span>
      ),
    },
    {
      key: 'overdue', label: 'Overdue Tasks',
      render: (r) => r.overdueCount > 0
        ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{r.overdueCount} late</span>
        : <span className="text-xs text-gray-300">—</span>,
    },
    {
      key: 'country', label: 'Country',
      render: (r) => r.account?.country?.name || '—',
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <button onClick={() => router.push(`/onboarding/${r.id}`)}
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          View →
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Journey Tracker</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Track every account from Deal Closure through to Account Management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
          >
            {seedMutation.isPending ? '⏳ Syncing…' : '⟳ Sync All Accounts'}
          </button>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button onClick={() => setView('kanban')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              ⊞ Kanban
            </button>
            <button onClick={() => setView('list')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              ☰ List
            </button>
          </div>
        </div>
      </div>

      {syncMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 font-medium">
          {syncMsg}
        </div>
      )}

      {/* Stage summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {PHASES.map((p) => {
          const phaseTrackers = baseFiltered.filter((t) => t.phase === p.key)
          const count    = phaseTrackers.length
          const overdue  = phaseTrackers.filter((t) => t.overdueCount > 0).length
          const active   = phase === p.key
          return (
            <button key={p.key} onClick={() => setPhase(active ? '' : p.key)}
              className={`rounded-xl border p-3 text-left transition-all ${active ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{p.icon} {p.label}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{count}</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-gray-400">{p.team}</p>
                {overdue > 0 && (
                  <span className="text-xs font-semibold text-red-500">{overdue} late</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search account…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56 bg-white" />
        <LeadSourceFilter value={leadSources} onChange={setLeadSources} />
        <MultiSelectFilter
          label="CS Rep" value={csReps_f} onChange={setCsReps_f}
          options={csReps.map((u) => ({ value: u.id, label: u.name }))}
        />
        {view === 'list' && (
          <div className="flex gap-1 flex-wrap">
            {[{ key: '', label: 'All', icon: '' }, ...PHASES].map((p) => (
              <button key={p.key} onClick={() => setPhase(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${phase === p.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {p.icon ? `${p.icon} ` : ''}{p.label}
              </button>
            ))}
          </div>
        )}
        <span className="text-sm text-gray-400 ml-auto">
          {filtered.length} account{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      ) : view === 'kanban' ? (

        /* Kanban Board */
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {PHASES.map((p) => {
            const cards = filtered.filter((t) => t.phase === p.key)
            const colMRR = cards.reduce((sum, t) => sum + (t.accountMRR || 0), 0)
            return (
              <div key={p.key} className="flex-none w-64">
                <div className={`rounded-t-xl px-3 py-2.5 border border-b-0 ${p.light}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${p.text}`}>{p.icon} {p.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.badge}`}>{cards.length}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-400">{p.team}</p>
                    {cards.length > 0 && (
                      <p className="text-xs font-semibold text-gray-700">
                        {colMRR > 0 ? `$${colMRR.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                        <span className="font-normal text-gray-400 ml-0.5">MRR</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className={`rounded-b-xl border ${p.light} p-2 space-y-2 min-h-[200px]`}>
                  {cards.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-gray-300 italic">No accounts</div>
                  ) : (
                    cards.map((t) => (
                      <TrackerCard key={t.id} tracker={t} phase={p}
                        onClick={() => router.push(`/onboarding/${t.id}`)} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        /* List Table */
        <DataTable columns={columns} data={filtered} exportFilename="customer-journey" />
      )}
    </div>
  )
}
