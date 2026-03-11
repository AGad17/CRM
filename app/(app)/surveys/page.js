'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function npsCategory(score) {
  if (score == null) return null
  if (score >= 9)  return { label: 'Promoter',   color: 'text-green-600',  bg: 'bg-green-100'  }
  if (score >= 7)  return { label: 'Passive',    color: 'text-amber-600',  bg: 'bg-amber-100'  }
  return               { label: 'Detractor', color: 'text-red-600',    bg: 'bg-red-100'    }
}

function csatEmoji(score) {
  return ['', '😞', '😕', '😐', '😊', '😍'][score] ?? ''
}

function npsColor(score) {
  if (score >= 9)  return 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
  if (score >= 7)  return 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
  return                  'bg-red-100   border-red-300   text-red-700   hover:bg-red-200'
}

function npsScoreColor(score) {
  if (score === null || score === undefined) return 'text-gray-400'
  if (score > 50)  return 'text-green-600'
  if (score > 0)   return 'text-amber-600'
  return                   'text-red-600'
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StageBar({ label, avgScore, csatPct, count }) {
  const pct = avgScore != null ? (avgScore / 5) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 font-medium">{label}</span>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{avgScore?.toFixed(1)}/5</span>
          <span className={csatPct >= 80 ? 'text-green-600 font-semibold' : csatPct >= 60 ? 'text-amber-600' : 'text-red-600'}>
            {csatPct}% CSAT
          </span>
          <span className="text-gray-400">{count} resp.</span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${
            csatPct >= 80 ? 'bg-green-500' : csatPct >= 60 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// NPS gauge: score from -100 to +100 mapped to a bar
function NpsGauge({ score }) {
  if (score == null) return <p className="text-gray-400 text-sm">No data yet</p>
  const pct    = ((score + 100) / 200) * 100   // map -100…+100 → 0…100%
  const color  = score > 50 ? 'bg-green-500' : score > 0 ? 'bg-amber-500' : 'bg-red-500'
  const label  = score > 50 ? 'Great' : score > 0 ? 'Good' : score < 0 ? 'Needs work' : 'Neutral'
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-extrabold ${npsScoreColor(score)}`}>
          {score > 0 ? '+' : ''}{score}
        </span>
        <span className="text-sm text-gray-400 mb-1">{label}</span>
      </div>
      <div className="relative h-3 bg-gradient-to-r from-red-200 via-amber-200 to-green-200 rounded-full overflow-hidden">
        {/* Centre line */}
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-gray-300 z-10" />
        {/* Indicator */}
        <div
          className={`absolute top-0 w-3 h-3 rounded-full ${color} border-2 border-white shadow -translate-x-1/2`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>−100</span><span>0</span><span>+100</span>
      </div>
      <p className="text-xs text-gray-400">
        Industry benchmarks: &gt;0 Good · &gt;30 Strong · &gt;50 Excellent · &gt;70 World-class
      </p>
    </div>
  )
}

// Inline survey form
function SurveyForm({ survey, onSubmit, onCancel, isPending }) {
  const [score, setScore] = useState(null)
  const [notes, setNotes] = useState('')

  const isCsat = survey.type === 'csat'

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      {isCsat ? (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Client satisfaction with this stage — 1 (very dissatisfied) to 5 (very satisfied)
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-all ${
                  score === n
                    ? 'bg-indigo-600 border-indigo-600 text-white scale-110'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                }`}
              >
                {n}
              </button>
            ))}
            {score && (
              <span className="text-2xl ml-1" title={['','Very dissatisfied','Dissatisfied','Neutral','Satisfied','Very satisfied'][score]}>
                {csatEmoji(score)}
              </span>
            )}
          </div>
          {score && (
            <p className="text-xs text-indigo-600 mt-1">
              {['','Very dissatisfied','Dissatisfied','Neutral','Satisfied','Very satisfied'][score]}
            </p>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            How likely is the client to recommend ShopBrain? — 0 (not at all) to 10 (extremely likely)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={`w-9 h-9 rounded-lg text-xs font-bold border-2 transition-all ${
                  score === i
                    ? 'bg-indigo-600 border-indigo-600 text-white scale-110'
                    : npsColor(i)
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
            <span>🔴 Detractor (0–6)</span>
            <span>🟡 Passive (7–8)</span>
            <span>🟢 Promoter (9–10)</span>
          </div>
          {score != null && (
            <p className={`text-xs mt-1 font-medium ${npsCategory(score).color}`}>
              {npsCategory(score).label}
            </p>
          )}
        </div>
      )}

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Optional notes from the conversation…"
        rows={2}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={score == null || isPending}
          onClick={() => onSubmit({ score, notes })}
          className="px-5 py-1.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors"
        >
          {isPending ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SurveysPage() {
  const qc = useQueryClient()
  const [tab,        setTab]        = useState('pending') // pending | csat | nps
  const [typeFilter, setTypeFilter] = useState('all')     // all | csat | nps
  const [openId,     setOpenId]     = useState(null)      // id of form currently open
  const [seedMsg,    setSeedMsg]    = useState(null)

  // ── Data ─────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn:  () => fetch('/api/surveys').then(r => r.json()),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────

  const csatMutation = useMutation({
    mutationFn: ({ id, score, notes }) =>
      fetch(`/api/onboarding/csat/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ score, notes }),
      }).then(r => r.json()),
    onSuccess: () => {
      setOpenId(null)
      qc.invalidateQueries({ queryKey: ['surveys'] })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })

  const npsMutation = useMutation({
    mutationFn: ({ id, score, notes }) =>
      fetch(`/api/onboarding/nps/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ score, notes }),
      }).then(r => r.json()),
    onSuccess: () => {
      setOpenId(null)
      qc.invalidateQueries({ queryKey: ['surveys'] })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })

  const npsTriggerMutation = useMutation({
    mutationFn: (trackerId) =>
      fetch('/api/surveys/nps-trigger', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ trackerId }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surveys'] }),
  })

  const npsSeedMutation = useMutation({
    mutationFn: () =>
      fetch('/api/onboarding/nps-seed', { method: 'POST' }).then(r => r.json()),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['surveys'] })
      setSeedMsg(d.count === 0
        ? 'All eligible accounts already have an NPS for this quarter.'
        : `✓ Created NPS surveys for ${d.count} account${d.count !== 1 ? 's' : ''} (${d.quarter}).`)
      setTimeout(() => setSeedMsg(null), 5000)
    },
  })

  // ── Derived values ────────────────────────────────────────────────────────

  const pending   = data?.pending   ?? { csat: [], nps: [] }
  const completed = data?.completed ?? { csat: [], nps: [] }
  const stats     = data?.stats     ?? { csat: {}, nps: {} }

  const allPending = [
    ...pending.csat.map(c => ({ ...c, type: 'csat' })),
    ...pending.nps.map(n => ({ ...n, type: 'nps' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const visiblePending = typeFilter === 'all'  ? allPending
    : typeFilter === 'csat' ? allPending.filter(s => s.type === 'csat')
    : allPending.filter(s => s.type === 'nps')

  const totalPending = pending.csat.length + pending.nps.length

  const s = stats
  const csatAvg  = s.csat?.avgScore
  const csatPct  = s.csat?.csatPct
  const npsScore = s.nps?.score

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-24 bg-gray-100 rounded-2xl" /><div className="h-96 bg-gray-100 rounded-2xl" /></div>

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">CSAT &amp; NPS Surveys</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Customer satisfaction tracking across the entire journey.
          </p>
        </div>
        <button
          onClick={() => npsSeedMutation.mutate()}
          disabled={npsSeedMutation.isPending}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-50 shadow-sm"
        >
          {npsSeedMutation.isPending ? '⏳ Seeding…' : '📊 Seed NPS — Current Quarter'}
        </button>
      </div>

      {seedMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 font-medium">
          {seedMsg}
        </div>
      )}

      {/* ── Summary KPI cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Pending Surveys"
          value={totalPending}
          sub={`${pending.csat.length} CSAT · ${pending.nps.length} NPS`}
          accent={totalPending > 0 ? 'text-amber-600' : 'text-gray-900'}
        />
        <StatCard
          label="Avg CSAT Score"
          value={csatAvg != null ? `${csatAvg.toFixed(1)}/5` : null}
          sub={csatAvg != null ? csatEmoji(Math.round(csatAvg)) : 'No data'}
        />
        <StatCard
          label="CSAT %"
          value={csatPct != null ? `${csatPct}%` : null}
          sub="Scores ≥ 4/5"
          accent={csatPct == null ? undefined : csatPct >= 80 ? 'text-green-600' : csatPct >= 60 ? 'text-amber-600' : 'text-red-600'}
        />
        <StatCard
          label="NPS Score"
          value={npsScore != null ? (npsScore > 0 ? `+${npsScore}` : `${npsScore}`) : null}
          sub={npsScore == null ? 'No data' : npsScore > 50 ? 'Excellent 🎉' : npsScore > 0 ? 'Good' : 'Needs work'}
          accent={npsScoreColor(npsScore)}
        />
        <StatCard
          label="CSAT Responses"
          value={s.csat?.responded ?? 0}
          sub={`of ${s.csat?.total ?? 0} sent · ${s.csat?.responseRate ?? 0}% rate`}
        />
        <StatCard
          label="NPS Responses"
          value={s.nps?.responded ?? 0}
          sub={`of ${s.nps?.total ?? 0} sent · ${s.nps?.responseRate ?? 0}% rate`}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {[
          { key: 'pending', label: `Pending${totalPending > 0 ? ` (${totalPending})` : ''}` },
          { key: 'csat',    label: 'CSAT Report' },
          { key: 'nps',     label: 'NPS Report'  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.key === 'pending' && totalPending > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs bg-amber-100 text-amber-700 font-bold">
                {totalPending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PENDING TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'pending' && (
        <div className="space-y-4">
          {/* Filter chips */}
          <div className="flex items-center gap-2">
            {[
              { key: 'all',  label: `All (${allPending.length})` },
              { key: 'csat', label: `CSAT (${pending.csat.length})` },
              { key: 'nps',  label: `NPS (${pending.nps.length})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === f.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visiblePending.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🎉</p>
              <p className="font-medium text-gray-600">No pending surveys</p>
              <p className="text-sm mt-1">All caught up! Use "Seed NPS" to trigger quarterly NPS surveys.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {visiblePending.map(survey => {
                const isOpen = openId === `${survey.type}-${survey.id}`
                const isSaving = (survey.type === 'csat' ? csatMutation : npsMutation).isPending

                return (
                  <div
                    key={`${survey.type}-${survey.id}`}
                    className={`bg-white rounded-xl border p-4 transition-shadow ${
                      isOpen ? 'border-indigo-200 shadow-md' : 'border-gray-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Type badge + account */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            survey.type === 'csat'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-violet-100 text-violet-700'
                          }`}>
                            {survey.type === 'csat' ? '📋 CSAT' : '📊 NPS'}
                          </span>
                          <span className="font-semibold text-gray-900 text-sm">
                            {survey.account?.name ?? 'Unknown account'}
                          </span>
                          {survey.account?.country?.name && (
                            <span className="text-xs text-gray-400">{survey.account.country.name}</span>
                          )}
                        </div>

                        {/* Survey context */}
                        <p className="text-xs text-gray-500 mt-1.5">
                          {survey.type === 'csat'
                            ? <>Transition: <strong className="text-gray-700">{survey.fromPhaseLabel}</strong> → <strong className="text-gray-700">{survey.toPhaseLabel}</strong></>
                            : <>Quarter: <strong className="text-gray-700">{survey.quarter}</strong> · Stage at trigger: <strong className="text-gray-700">{survey.phaseLabel}</strong></>
                          }
                        </p>
                        {survey.deal?.package && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {survey.deal.package}{survey.deal.posSystem ? ` · ${survey.deal.posSystem}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          Created {new Date(survey.createdAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>

                      {!isOpen && (
                        <button
                          onClick={() => setOpenId(`${survey.type}-${survey.id}`)}
                          className="flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                        >
                          Fill survey →
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <SurveyForm
                        survey={survey}
                        isPending={isSaving}
                        onCancel={() => setOpenId(null)}
                        onSubmit={({ score, notes }) => {
                          if (survey.type === 'csat') {
                            csatMutation.mutate({ id: survey.id, score, notes })
                          } else {
                            npsMutation.mutate({ id: survey.id, score, notes })
                          }
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CSAT REPORT TAB                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'csat' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Average Score"     value={csatAvg != null ? `${csatAvg.toFixed(1)}/5` : null} sub={csatAvg != null ? csatEmoji(Math.round(csatAvg)) : 'No data'} />
            <StatCard label="CSAT %"            value={csatPct != null ? `${csatPct}%` : null}            sub="Scores ≥ 4/5 (industry standard)" accent={csatPct == null ? undefined : csatPct >= 80 ? 'text-green-600' : csatPct >= 60 ? 'text-amber-600' : 'text-red-600'} />
            <StatCard label="Total Responses"   value={s.csat?.responded ?? 0}                             sub={`${s.csat?.responseRate ?? 0}% response rate`} />
            <StatCard label="Surveys Sent"      value={s.csat?.total ?? 0}                                 sub={`${s.csat?.total - (s.csat?.responded ?? 0)} pending`} />
          </div>

          {/* Benchmark callout */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-700">
            <strong>Industry benchmarks (SaaS):</strong> CSAT% ≥ 80% is excellent · 70–80% is good · &lt;70% needs attention. Average score ≥ 4.0/5 is strong.
          </div>

          {/* By stage breakdown */}
          {(s.csat?.byStage ?? []).length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Score by Stage Transition</h3>
              <div className="space-y-4">
                {s.csat.byStage.map(row => (
                  <StageBar key={row.label} {...row} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No completed CSAT surveys yet.</p>
          )}

          {/* Per-account completed CSAT table */}
          {completed.csat.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">All CSAT Responses</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Account</th>
                    <th className="px-4 py-2.5 text-left">Transition</th>
                    <th className="px-4 py-2.5 text-center">Score</th>
                    <th className="px-4 py-2.5 text-left">Notes</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {completed.csat.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.account?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.fromPhaseLabel} → {c.toPhaseLabel}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          c.score >= 4 ? 'bg-green-100 text-green-700' :
                          c.score >= 3 ? 'bg-amber-100 text-amber-700' :
                                          'bg-red-100 text-red-700'
                        }`}>
                          {c.score}/5 {csatEmoji(c.score)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{c.notes || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.completedAt).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* NPS REPORT TAB                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'nps' && (
        <div className="space-y-6">
          {/* Top section: gauge + distribution side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gauge */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">NPS Score</h3>
              <NpsGauge score={npsScore} />
            </div>

            {/* Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Response Distribution</h3>
              {(s.nps?.responded ?? 0) === 0 ? (
                <p className="text-sm text-gray-400">No completed NPS surveys yet.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Promoters',  pct: s.nps.promoterPct,  count: s.nps.promoters,  color: 'bg-green-500', text: 'text-green-700', hint: '9–10' },
                    { label: 'Passives',   pct: s.nps.passivePct,   count: s.nps.passives,   color: 'bg-amber-400', text: 'text-amber-700', hint: '7–8'  },
                    { label: 'Detractors', pct: s.nps.detractorPct, count: s.nps.detractors, color: 'bg-red-500',   text: 'text-red-700',   hint: '0–6'  },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-medium ${row.text}`}>{row.label} <span className="text-gray-400 font-normal">({row.hint})</span></span>
                        <span className={`font-bold ${row.text}`}>{row.pct}% <span className="text-gray-400 font-normal">({row.count})</span></span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-2.5 ${row.color} rounded-full transition-all`} style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                    NPS = (Promoters% − Detractors%) · Range −100 to +100
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="NPS Score"       value={npsScore != null ? (npsScore > 0 ? `+${npsScore}` : `${npsScore}`) : null} sub={npsScore == null ? 'No data' : npsScore > 50 ? 'Excellent' : npsScore > 0 ? 'Good' : 'Needs work'} accent={npsScoreColor(npsScore)} />
            <StatCard label="Total Responses" value={s.nps?.responded ?? 0} sub={`${s.nps?.responseRate ?? 0}% response rate`} />
            <StatCard label="Promoters"       value={s.nps?.promoters  ?? 0} sub={`${s.nps?.promoterPct  ?? 0}%`} accent="text-green-600" />
            <StatCard label="Detractors"      value={s.nps?.detractors ?? 0} sub={`${s.nps?.detractorPct ?? 0}%`} accent={(s.nps?.detractors ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'} />
          </div>

          {/* Benchmark callout */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-700">
            <strong>Industry benchmarks (SaaS / B2B):</strong> &gt;0 Good · &gt;30 Strong · &gt;50 Excellent · &gt;70 World-class. Average SaaS NPS is around +31.
          </div>

          {/* By quarter */}
          {(s.nps?.byQuarter ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">NPS by Quarter</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Quarter</th>
                    <th className="px-4 py-2.5 text-center">NPS Score</th>
                    <th className="px-4 py-2.5 text-center">Responses</th>
                    <th className="px-4 py-2.5 text-center">Promoters</th>
                    <th className="px-4 py-2.5 text-center">Detractors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {s.nps.byQuarter.map(q => (
                    <tr key={q.quarter} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{q.quarter}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${npsScoreColor(q.score)}`}>
                          {q.score > 0 ? '+' : ''}{q.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{q.count}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">{q.promoterPct}%</td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">{q.detractorPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-account NPS table */}
          {completed.nps.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">All NPS Responses</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Account</th>
                    <th className="px-4 py-2.5 text-left">Quarter</th>
                    <th className="px-4 py-2.5 text-center">Score</th>
                    <th className="px-4 py-2.5 text-left">Category</th>
                    <th className="px-4 py-2.5 text-left">Notes</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {completed.nps.map(n => {
                    const cat = npsCategory(n.score)
                    return (
                      <tr key={n.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{n.account?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{n.quarter}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-700">{n.score}/10</td>
                        <td className="px-4 py-3">
                          {cat && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cat.bg} ${cat.color}`}>
                              {cat.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{n.notes || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(n.completedAt).toLocaleDateString('en-GB')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {completed.nps.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No completed NPS surveys yet. Use "Seed NPS" to get started.</p>
          )}
        </div>
      )}

    </div>
  )
}
