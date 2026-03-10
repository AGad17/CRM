'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'

const PHASES = [
  { key: '',            label: 'All' },
  { key: 'WelcomeCall', label: 'Welcome Call' },
  { key: 'Onboarding',  label: 'Onboarding' },
  { key: 'Training',    label: 'Training' },
  { key: 'Incubation',  label: 'Incubation' },
  { key: 'Active',      label: 'Active' },
]

const PHASE_COLORS = {
  WelcomeCall: 'bg-blue-100 text-blue-700',
  Onboarding:  'bg-yellow-100 text-yellow-700',
  Training:    'bg-purple-100 text-purple-700',
  Incubation:  'bg-orange-100 text-orange-700',
  Active:      'bg-green-100 text-green-700',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState('')
  const [search, setSearch] = useState('')

  const { data: trackers = [], isLoading } = useQuery({
    queryKey: ['onboarding', phase],
    queryFn: () => fetch(`/api/onboarding${phase ? `?phase=${phase}` : ''}`).then(r => r.json()),
  })

  const filtered = search
    ? trackers.filter(t => t.account?.name?.toLowerCase().includes(search.toLowerCase()))
    : trackers

  const columns = [
    {
      key: 'account',
      label: 'Account',
      render: (r) => (
        <span className="font-medium text-gray-900">{r.account?.name || '—'}</span>
      ),
      sortable: true,
    },
    {
      key: 'phase',
      label: 'Phase',
      render: (r) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PHASE_COLORS[r.phase] || 'bg-gray-100 text-gray-600'}`}>
          {r.phaseLabel}
        </span>
      ),
    },
    {
      key: 'progress',
      label: 'Phase Progress',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-20">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all"
              style={{ width: `${r.currentPhaseTasks > 0 ? Math.round((r.currentPhaseCompleted / r.currentPhaseTasks) * 100) : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {r.currentPhaseCompleted}/{r.currentPhaseTasks}
          </span>
        </div>
      ),
    },
    {
      key: 'started',
      label: 'Started',
      render: (r) => new Date(r.startDate).toLocaleDateString('en-GB'),
      sortable: true,
    },
    {
      key: 'daysInPhase',
      label: 'Days in Phase',
      render: (r) => <span className="text-gray-500">{r.daysInPhase}d</span>,
      sortable: true,
    },
    {
      key: 'country',
      label: 'Country',
      render: (r) => r.account?.country?.name || '—',
    },
    {
      key: 'actions',
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

  // Summary counts per phase
  const counts = PHASES.slice(1).map(p => ({
    ...p,
    count: trackers.filter(t => t.phase === p.key).length,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Onboarding Tracker</h2>
        <p className="text-sm text-gray-500 mt-1">Track account onboarding from Welcome Call to Active.</p>
      </div>

      {/* Phase summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {counts.map(p => (
          <button
            key={p.key}
            onClick={() => setPhase(phase === p.key ? '' : p.key)}
            className={`rounded-xl border p-3 text-left transition-all ${
              phase === p.key
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <p className="text-xs text-gray-400 uppercase tracking-wider">{p.label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{p.count}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search account…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56"
        />
        <div className="flex gap-1">
          {PHASES.map(p => (
            <button
              key={p.key}
              onClick={() => setPhase(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                phase === p.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400">{filtered.length} trackers</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />
      ) : (
        <DataTable columns={columns} data={filtered} exportFilename="onboarding" />
      )}
    </div>
  )
}
