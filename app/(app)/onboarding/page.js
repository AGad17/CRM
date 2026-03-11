'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = [
  {
    key:   'WelcomeCall',
    label: 'Welcome Call',
    icon:  '📞',
    light: 'bg-blue-50 border-blue-200',
    text:  'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    bar:   'bg-blue-500',
  },
  {
    key:   'Onboarding',
    label: 'Onboarding',
    icon:  '🏗️',
    light: 'bg-yellow-50 border-yellow-200',
    text:  'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    bar:   'bg-yellow-500',
  },
  {
    key:   'Training',
    label: 'Training',
    icon:  '📚',
    light: 'bg-purple-50 border-purple-200',
    text:  'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    bar:   'bg-purple-500',
  },
  {
    key:   'Incubation',
    label: 'Incubation',
    icon:  '🔍',
    light: 'bg-orange-50 border-orange-200',
    text:  'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
    bar:   'bg-orange-500',
  },
  {
    key:   'Active',
    label: 'Active',
    icon:  '✅',
    light: 'bg-green-50 border-green-200',
    text:  'text-green-700',
    badge: 'bg-green-100 text-green-700',
    bar:   'bg-green-500',
  },
]

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
      {/* Account name */}
      <p className="font-semibold text-sm text-gray-900 leading-tight truncate">
        {tracker.account?.name || '—'}
      </p>

      {/* Country + Days in phase */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 truncate">
          {tracker.account?.country?.name || '—'}
        </span>
        <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${daysCls}`}>
          {tracker.daysInPhase}d
        </span>
      </div>

      {/* Package + POS */}
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

      {/* Phase progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Phase progress</span>
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

      {/* Started date */}
      <p className="text-xs text-gray-300">
        Started {new Date(tracker.startDate).toLocaleDateString('en-GB')}
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [view,   setView]   = useState('kanban')
  const [phase,  setPhase]  = useState('')
  const [search, setSearch] = useState('')

  // Always fetch everything — filter client-side for both views
  const { data: trackers = [], isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn:  () => fetch('/api/onboarding').then((r) => r.json()),
  })

  // Shared filter logic for both views
  const filtered = trackers.filter((t) => {
    if (phase  && t.phase !== phase) return false
    if (search && !t.account?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── Table columns (list view) ──
  const columns = [
    {
      key:      'account',
      label:    'Account',
      sortable: true,
      render:   (r) => <span className="font-medium text-gray-900">{r.account?.name || '—'}</span>,
    },
    {
      key:   'phase',
      label: 'Phase',
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
      key:   'progress',
      label: 'Phase Progress',
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
      key:      'started',
      label:    'Started',
      sortable: true,
      render:   (r) => new Date(r.startDate).toLocaleDateString('en-GB'),
    },
    {
      key:      'daysInPhase',
      label:    'Days in Phase',
      sortable: true,
      render:   (r) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          r.daysInPhase > 14 ? 'bg-red-100 text-red-600' :
          r.daysInPhase > 7  ? 'bg-amber-100 text-amber-600' :
                               'text-gray-500'
        }`}>
          {r.daysInPhase}d
        </span>
      ),
    },
    {
      key:   'country',
      label: 'Country',
      render: (r) => r.account?.country?.name || '—',
    },
    {
      key:   'actions',
      label: '',
      render: (r) => (
        <button
          onClick={() => router.push(`/onboarding/${r.id}`)}
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
        >
          View →
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Onboarding Tracker</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track account onboarding from Welcome Call to Active.</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => setView('kanban')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === 'kanban' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            ⊞ Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            ☰ List
          </button>
        </div>
      </div>

      {/* ── Phase summary count cards (clickable filter) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {PHASES.map((p) => {
          const count = trackers.filter((t) => t.phase === p.key).length
          const active = phase === p.key
          return (
            <button
              key={p.key}
              onClick={() => setPhase(active ? '' : p.key)}
              className={`rounded-xl border p-3 text-left transition-all ${
                active ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className="text-xs text-gray-400 uppercase tracking-wider">{p.icon} {p.label}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{count}</p>
            </button>
          )
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search account…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56 bg-white"
        />
        {/* Phase filter tabs — only shown in list view; kanban uses column headers */}
        {view === 'list' && (
          <div className="flex gap-1 flex-wrap">
            {[{ key: '', label: 'All' }, ...PHASES].map((p) => (
              <button
                key={p.key}
                onClick={() => setPhase(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  phase === p.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.icon ? `${p.icon} ` : ''}{p.label}
              </button>
            ))}
          </div>
        )}
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} tracker{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      ) : view === 'kanban' ? (

        /* ── Kanban Board ─────────────────────────────────────────────── */
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {PHASES.map((p) => {
            const cards = filtered.filter((t) => t.phase === p.key)
            return (
              <div key={p.key} className="flex-none w-64">

                {/* Column header */}
                <div className={`rounded-t-xl px-3 py-2.5 border border-b-0 ${p.light} flex items-center justify-between`}>
                  <span className={`text-sm font-semibold ${p.text}`}>
                    {p.icon} {p.label}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.badge}`}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards container */}
                <div className={`rounded-b-xl border ${p.light} p-2 space-y-2 min-h-[200px]`}>
                  {cards.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-gray-300 italic">
                      No accounts
                    </div>
                  ) : (
                    cards.map((t) => (
                      <TrackerCard
                        key={t.id}
                        tracker={t}
                        phase={p}
                        onClick={() => router.push(`/onboarding/${t.id}`)}
                      />
                    ))
                  )}
                </div>

              </div>
            )
          })}
        </div>

      ) : (

        /* ── List Table ───────────────────────────────────────────────── */
        <DataTable columns={columns} data={filtered} exportFilename="onboarding" />

      )}
    </div>
  )
}
