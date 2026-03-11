'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'

const PHASE_ORDER = ['DealClosure', 'Onboarding', 'Training', 'Incubation', 'AccountManagement']

const PHASE_LABELS = {
  DealClosure:       'Deal Closure',
  Onboarding:        'Onboarding',
  Training:          'Training',
  Incubation:        'Incubation',
  AccountManagement: 'Account Management',
}

const PHASE_ICONS = {
  DealClosure:       '🤝',
  Onboarding:        '🏗️',
  Training:          '📚',
  Incubation:        '🔍',
  AccountManagement: '⭐',
}

const PHASE_TEAMS = {
  DealClosure:       'Sales / Account Management',
  Onboarding:        'Onboarding Team',
  Training:          'Onboarding Team',
  Incubation:        'Onboarding Team',
  AccountManagement: 'Customer Success Team',
}

const PHASE_COLORS = {
  DealClosure:       { badge: 'bg-sky-100 text-sky-700',       section: 'border-sky-200 bg-sky-50',       heading: 'text-sky-700',    bar: 'bg-sky-500',    ring: 'ring-sky-400',    btn: 'bg-sky-600 hover:bg-sky-700'    },
  Onboarding:        { badge: 'bg-yellow-100 text-yellow-700', section: 'border-yellow-200 bg-yellow-50', heading: 'text-yellow-700', bar: 'bg-yellow-500', ring: 'ring-yellow-400', btn: 'bg-yellow-600 hover:bg-yellow-700' },
  Training:          { badge: 'bg-purple-100 text-purple-700', section: 'border-purple-200 bg-purple-50', heading: 'text-purple-700', bar: 'bg-purple-500', ring: 'ring-purple-400', btn: 'bg-purple-600 hover:bg-purple-700' },
  Incubation:        { badge: 'bg-orange-100 text-orange-700', section: 'border-orange-200 bg-orange-50', heading: 'text-orange-700', bar: 'bg-orange-500', ring: 'ring-orange-400', btn: 'bg-orange-600 hover:bg-orange-700' },
  AccountManagement: { badge: 'bg-green-100 text-green-700',   section: 'border-green-200 bg-green-50',   heading: 'text-green-700',  bar: 'bg-green-500',  ring: 'ring-green-400',  btn: 'bg-green-600 hover:bg-green-700'  },
}

export default function OnboardingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const notesRef = useRef(null)

  // pendingPhase = { phase, idx } — set when user clicks a step or nav button
  const [pendingPhase, setPendingPhase] = useState(null)

  const { data: tracker, isLoading } = useQuery({
    queryKey: ['onboarding', id],
    queryFn: () => fetch(`/api/onboarding/${id}`).then(r => r.json()),
  })

  const toggleMutation = useMutation({
    mutationFn: (taskId) =>
      fetch(`/api/onboarding/${id}/tasks/${taskId}`, { method: 'PATCH' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding', id] }),
  })

  const setPhaseMutation = useMutation({
    mutationFn: (phase) =>
      fetch(`/api/onboarding/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'setPhase', phase }),
      }).then(r => r.json()),
    onSuccess: () => {
      setPendingPhase(null)
      qc.invalidateQueries({ queryKey: ['onboarding', id] })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })

  const notesMutation = useMutation({
    mutationFn: (notes) =>
      fetch(`/api/onboarding/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'notes', notes }),
      }).then(r => r.json()),
  })

  if (isLoading) return <div className="animate-pulse h-96 bg-gray-100 rounded-2xl" />
  if (!tracker || tracker.error) return <div className="text-red-500">Tracker not found</div>

  const currentPhaseIdx   = PHASE_ORDER.indexOf(tracker.phase)
  const currentColors     = PHASE_COLORS[tracker.phase] || PHASE_COLORS.DealClosure
  const currentTasks      = tracker.tasksByPhase?.[tracker.phase] || []
  const allCurrentDone    = currentTasks.length > 0 && currentTasks.every(t => t.completed)
  const incompleteCurrent = currentTasks.filter(t => !t.completed).length

  const prevPhase = PHASE_ORDER[currentPhaseIdx - 1] ?? null
  const nextPhase = PHASE_ORDER[currentPhaseIdx + 1] ?? null

  function requestMove(phase) {
    if (phase === tracker.phase) return
    const idx = PHASE_ORDER.indexOf(phase)
    setPendingPhase({ phase, idx })
  }

  function handleNotesBlur() {
    notesMutation.mutate(notesRef.current?.value ?? '')
  }

  const pendingIdx       = pendingPhase ? PHASE_ORDER.indexOf(pendingPhase.phase) : null
  const pendingDirection = pendingIdx !== null ? (pendingIdx > currentPhaseIdx ? 'forward' : 'backward') : null
  const pendingColors    = pendingPhase ? PHASE_COLORS[pendingPhase.phase] : null

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/onboarding')} className="text-sm text-gray-400 hover:text-gray-700">
          ← Customer Journey
        </button>
        <h2 className="text-xl font-bold text-gray-900">{tracker.account?.name}</h2>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${currentColors.badge}`}>
          {PHASE_ICONS[tracker.phase]} {PHASE_LABELS[tracker.phase]}
        </span>
        <span className="text-xs text-gray-400 italic">{PHASE_TEAMS[tracker.phase]}</span>
      </div>

      {/* Deal info strip */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Country</p>
          <p className="font-medium text-gray-700">{tracker.account?.country?.name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Package</p>
          <p className="font-medium text-gray-700">{tracker.deal?.package || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">POS System</p>
          <p className="font-medium text-gray-700">{tracker.deal?.posSystem || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Deal Start</p>
          <p className="font-medium text-gray-700">
            {tracker.deal?.startDate ? new Date(tracker.deal.startDate).toLocaleDateString('en-GB') : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Journey Started</p>
          <p className="font-medium text-gray-700">{new Date(tracker.startDate).toLocaleDateString('en-GB')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Overall Progress</p>
          <p className="font-medium text-gray-700">{tracker.completedTasks}/{tracker.totalTasks} tasks</p>
        </div>
      </div>

      {/* ── Clickable Phase Stepper ─────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Click any stage to move the account</p>
        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {PHASE_ORDER.map((phase, idx) => {
            const isPast    = idx < currentPhaseIdx
            const isCurrent = idx === currentPhaseIdx
            const colors    = PHASE_COLORS[phase]

            return (
              <div key={phase} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <button
                    onClick={() => requestMove(phase)}
                    disabled={isCurrent}
                    title={isCurrent ? 'Current stage' : `Move to ${PHASE_LABELS[phase]}`}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all focus:outline-none ${
                      isCurrent
                        ? `${colors.bar} border-transparent text-white ring-2 ring-offset-2 ${colors.ring} cursor-default`
                        : isPast
                          ? 'bg-green-500 border-green-500 text-white hover:bg-green-400 hover:scale-110 cursor-pointer'
                          : 'bg-white border-gray-300 text-gray-400 hover:border-gray-400 hover:scale-110 cursor-pointer'
                    }`}
                  >
                    {isPast ? '✓' : PHASE_ICONS[phase]}
                  </button>
                  <p className={`text-xs mt-1.5 text-center whitespace-nowrap font-medium ${
                    isCurrent ? colors.heading :
                    isPast    ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {PHASE_LABELS[phase]}
                  </p>
                  <p className="text-xs text-gray-400 text-center whitespace-nowrap hidden sm:block">
                    {PHASE_TEAMS[phase].split('/')[0].trim().split(' ').slice(0, 2).join(' ')}
                  </p>
                </div>
                {idx < PHASE_ORDER.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-9 ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Move Confirmation Card ──────────────────────────────────────────── */}
      {pendingPhase && (
        <div className={`rounded-xl border p-4 ${pendingColors.section}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`font-semibold text-sm ${pendingColors.heading}`}>
                {pendingDirection === 'backward' ? '← Move back to' : 'Move forward to →'}{' '}
                {PHASE_ICONS[pendingPhase.phase]} {PHASE_LABELS[pendingPhase.phase]}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Responsible team: {PHASE_TEAMS[pendingPhase.phase]}
              </p>
              {pendingDirection === 'forward' && !allCurrentDone && (
                <p className="text-xs text-amber-600 mt-1.5 font-medium">
                  ⚠️ {incompleteCurrent} task{incompleteCurrent !== 1 ? 's' : ''} still incomplete in the current stage.
                </p>
              )}
              {pendingDirection === 'backward' && (
                <p className="text-xs text-gray-500 mt-1.5">
                  Completed tasks will not be reset.
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setPendingPhase(null)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setPhaseMutation.mutate(pendingPhase.phase)}
                disabled={setPhaseMutation.isPending}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors ${pendingColors.btn}`}
              >
                {setPhaseMutation.isPending ? 'Moving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick nav buttons ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {prevPhase && (
          <button
            onClick={() => requestMove(prevPhase)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← {PHASE_LABELS[prevPhase]}
          </button>
        )}
        <div className="flex-1" />
        {nextPhase && (
          <button
            onClick={() => requestMove(nextPhase)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${
              allCurrentDone ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {allCurrentDone ? '' : '⚠️ '}
            {PHASE_LABELS[nextPhase]} →
          </button>
        )}
      </div>

      {/* ── Task sections by phase ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {PHASE_ORDER.map((phase, phaseIdx) => {
          const tasks     = tracker.tasksByPhase?.[phase] || []
          const isPast    = phaseIdx < currentPhaseIdx
          const isCurrent = phaseIdx === currentPhaseIdx
          const isFuture  = phaseIdx > currentPhaseIdx
          const doneCount = tasks.filter(t => t.completed).length
          const colors    = PHASE_COLORS[phase]

          return (
            <div key={phase} className={`rounded-xl border p-4 ${
              isCurrent ? colors.section :
              isPast    ? 'border-green-100 bg-green-50' :
                          'border-gray-100 bg-gray-50'
            }`}>
              {/* Phase header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{PHASE_ICONS[phase]}</span>
                  <h3 className={`font-semibold text-sm ${
                    isCurrent ? colors.heading :
                    isPast    ? 'text-green-700' : 'text-gray-400'
                  }`}>
                    {PHASE_LABELS[phase]}
                  </h3>
                  <span className={`text-xs ${
                    isCurrent ? 'text-gray-500' :
                    isPast    ? 'text-green-500' : 'text-gray-300'
                  }`}>
                    · {PHASE_TEAMS[phase]}
                  </span>
                  {isPast    && <span className="text-xs text-green-600 font-medium ml-1">✓ Completed</span>}
                  {isCurrent && (
                    <span className={`text-xs font-medium ml-1 ${colors.heading}`}>
                      {doneCount}/{tasks.length} done
                    </span>
                  )}
                </div>
                {isCurrent && tasks.length > 0 && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`${colors.bar} h-1.5 rounded-full transition-all`}
                        style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs ${colors.heading}`}>
                      {Math.round((doneCount / tasks.length) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Task list */}
              <ul className="space-y-2">
                {tasks.map((task, taskIdx) => (
                  <li key={task.id} className="flex items-start gap-3">
                    <button
                      disabled={!isCurrent || toggleMutation.isPending}
                      onClick={() => isCurrent && toggleMutation.mutate(task.id)}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : isCurrent
                            ? 'border-gray-300 hover:border-gray-500 bg-white cursor-pointer'
                            : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                      }`}
                    >
                      {task.completed && <span className="text-xs">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 ${
                      task.completed ? 'line-through text-gray-400' :
                      isFuture       ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      <span className="text-gray-400 mr-1.5 text-xs">{taskIdx + 1}.</span>
                      {task.title}
                    </span>
                    {task.completed && task.completedAt && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(task.completedAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Internal Notes
        </label>
        <textarea
          ref={notesRef}
          defaultValue={tracker.notes || ''}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this account's customer journey…"
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Notes are saved automatically when you click away.</p>
      </div>

    </div>
  )
}
