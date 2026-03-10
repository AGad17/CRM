'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'

const PHASE_ORDER = ['WelcomeCall', 'Onboarding', 'Training', 'Incubation', 'Active']
const PHASE_LABELS = {
  WelcomeCall: 'Welcome Call',
  Onboarding:  'Onboarding',
  Training:    'Training',
  Incubation:  'Incubation',
  Active:      'Active',
}
const PHASE_ICONS = {
  WelcomeCall: '📞',
  Onboarding:  '🏗️',
  Training:    '📚',
  Incubation:  '🔍',
  Active:      '✅',
}

export default function OnboardingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const notesRef = useRef(null)
  const [advanceWarning, setAdvanceWarning] = useState(false)

  const { data: tracker, isLoading } = useQuery({
    queryKey: ['onboarding', id],
    queryFn: () => fetch(`/api/onboarding/${id}`).then(r => r.json()),
  })

  const toggleMutation = useMutation({
    mutationFn: (taskId) =>
      fetch(`/api/onboarding/${id}/tasks/${taskId}`, { method: 'PATCH' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding', id] }),
  })

  const advanceMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/onboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance' }),
      }).then(r => r.json()),
    onSuccess: () => {
      setAdvanceWarning(false)
      qc.invalidateQueries({ queryKey: ['onboarding', id] })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })

  const notesMutation = useMutation({
    mutationFn: (notes) =>
      fetch(`/api/onboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notes', notes }),
      }).then(r => r.json()),
  })

  if (isLoading) return <div className="animate-pulse h-96 bg-gray-100 rounded-2xl" />
  if (!tracker || tracker.error) return <div className="text-red-500">Tracker not found</div>

  const currentPhaseIdx = PHASE_ORDER.indexOf(tracker.phase)
  const nextPhase = PHASE_ORDER[currentPhaseIdx + 1]
  const isLastPhase = currentPhaseIdx === PHASE_ORDER.length - 1

  const currentTasks = tracker.tasksByPhase?.[tracker.phase] || []
  const allCurrentDone = currentTasks.length > 0 && currentTasks.every(t => t.completed)
  const incompleteCurrent = currentTasks.filter(t => !t.completed).length

  function handleAdvanceClick() {
    if (!allCurrentDone && !advanceWarning) {
      setAdvanceWarning(true)
      return
    }
    advanceMutation.mutate()
  }

  function handleNotesBlur() {
    notesMutation.mutate(notesRef.current?.value ?? '')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/onboarding')} className="text-sm text-gray-400 hover:text-gray-700">
          ← Onboarding
        </button>
        <h2 className="text-xl font-bold text-gray-900">{tracker.account?.name}</h2>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
          tracker.phase === 'Active' ? 'bg-green-100 text-green-700' :
          tracker.phase === 'WelcomeCall' ? 'bg-blue-100 text-blue-700' :
          'bg-indigo-100 text-indigo-700'
        }`}>
          {PHASE_ICONS[tracker.phase]} {PHASE_LABELS[tracker.phase]}
        </span>
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
          <p className="text-xs text-gray-400 uppercase tracking-wider">Onboarding Started</p>
          <p className="font-medium text-gray-700">{new Date(tracker.startDate).toLocaleDateString('en-GB')}</p>
        </div>
      </div>

      {/* Phase Stepper */}
      <div className="flex items-center gap-0">
        {PHASE_ORDER.map((phase, idx) => {
          const isPast    = idx < currentPhaseIdx
          const isCurrent = idx === currentPhaseIdx
          const isFuture  = idx > currentPhaseIdx
          return (
            <div key={phase} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  isPast    ? 'bg-green-500 border-green-500 text-white' :
                  isCurrent ? 'bg-indigo-600 border-indigo-600 text-white' :
                              'bg-white border-gray-300 text-gray-400'
                }`}>
                  {isPast ? '✓' : idx + 1}
                </div>
                <p className={`text-xs mt-1 text-center whitespace-nowrap ${
                  isCurrent ? 'text-indigo-600 font-semibold' :
                  isPast    ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {PHASE_ICONS[phase]} {PHASE_LABELS[phase]}
                </p>
              </div>
              {idx < PHASE_ORDER.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mb-5 ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Task sections by phase */}
      <div className="space-y-4">
        {PHASE_ORDER.map((phase, phaseIdx) => {
          const tasks      = tracker.tasksByPhase?.[phase] || []
          const isPast     = phaseIdx < currentPhaseIdx
          const isCurrent  = phaseIdx === currentPhaseIdx
          const isFuture   = phaseIdx > currentPhaseIdx
          const doneCount  = tasks.filter(t => t.completed).length

          return (
            <div key={phase} className={`rounded-xl border p-4 ${
              isCurrent ? 'border-indigo-200 bg-indigo-50' :
              isPast    ? 'border-green-100 bg-green-50' :
                          'border-gray-100 bg-gray-50'
            }`}>
              {/* Phase header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{PHASE_ICONS[phase]}</span>
                  <h3 className={`font-semibold text-sm ${isCurrent ? 'text-indigo-700' : isPast ? 'text-green-700' : 'text-gray-400'}`}>
                    {PHASE_LABELS[phase]}
                  </h3>
                  {isPast && <span className="text-xs text-green-600 font-medium">✓ Completed</span>}
                  {isCurrent && (
                    <span className="text-xs text-indigo-600 font-medium">
                      {doneCount}/{tasks.length} done
                    </span>
                  )}
                </div>
                {isCurrent && tasks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-indigo-100 rounded-full h-1.5">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-indigo-600">
                      {Math.round((doneCount / tasks.length) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Task list */}
              <ul className="space-y-2">
                {tasks.map(task => (
                  <li key={task.id} className="flex items-center gap-3">
                    <button
                      disabled={!isCurrent || toggleMutation.isPending}
                      onClick={() => isCurrent && toggleMutation.mutate(task.id)}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : isCurrent
                            ? 'border-indigo-300 hover:border-indigo-500 bg-white cursor-pointer'
                            : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                      }`}
                    >
                      {task.completed && <span className="text-xs">✓</span>}
                    </button>
                    <span className={`text-sm ${
                      task.completed ? 'line-through text-gray-400' :
                      isFuture       ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {task.title}
                    </span>
                    {task.completed && task.completedAt && (
                      <span className="text-xs text-gray-400 ml-auto">
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

      {/* Advance phase button */}
      {!isLastPhase && (
        <div className="flex flex-col gap-2">
          {advanceWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              ⚠️ {incompleteCurrent} task{incompleteCurrent !== 1 ? 's' : ''} still incomplete in this phase. Click again to advance anyway.
            </div>
          )}
          <button
            onClick={handleAdvanceClick}
            disabled={advanceMutation.isPending}
            className={`self-start px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              allCurrentDone
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {advanceMutation.isPending
              ? 'Advancing…'
              : `Advance to ${PHASE_LABELS[nextPhase]} →`}
          </button>
        </div>
      )}

      {isLastPhase && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-green-700 font-medium">
          🎉 This account has completed onboarding and is now Active.
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Notes
        </label>
        <textarea
          ref={notesRef}
          defaultValue={tracker.notes || ''}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this account's onboarding…"
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Notes are saved automatically when you click away.</p>
      </div>
    </div>
  )
}
