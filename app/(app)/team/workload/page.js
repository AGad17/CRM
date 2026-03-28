'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

const STAGE_LABELS = {
  Lead: 'Lead', Qualified: 'Qualified', Demo: 'Demo', Proposal: 'Proposal',
  Negotiation: 'Negotiation', ClosedWon: 'Closed Won', ClosedLost: 'Closed Lost',
}
const PHASE_LABELS = {
  DealClosure: 'Deal Closure', Onboarding: 'Onboarding', Training: 'Training',
  Incubation: 'Incubation', AccountManagement: 'Account Mgmt', Expired: 'Expired',
}
const STATUS_COLORS = {
  Open: 'bg-blue-100 text-blue-700',
  Escalated: 'bg-red-100 text-red-700',
}
const MODULE_LABELS = {
  all: 'All Modules', onboarding: 'Onboarding', cases: 'Cases',
  pipeline: 'Pipeline', invoicing: 'Invoicing',
}

function SectionHeader({ title, count, icon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{count}</span>
    </div>
  )
}

function EmptyRow({ text }) {
  return <p className="text-xs text-gray-400 italic py-2">{text}</p>
}

export default function WorkloadPage() {
  const router = useRouter()
  const [userId, setUserId]   = useState('')
  const [module, setModule]   = useState('all')
  const [overdueOnly, setOverdueOnly] = useState(false)

  // Fetch users for filter
  const { data: users = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => fetch('/api/users/staff').then(r => r.json()),
  })

  const params = new URLSearchParams()
  if (userId) params.set('userId', userId)
  if (module !== 'all') params.set('module', module)

  const { data, isLoading } = useQuery({
    queryKey: ['workload', userId, module],
    queryFn: () => fetch(`/api/reports/workload?${params}`).then(r => r.json()),
  })

  const tasks  = useMemo(() => {
    const t = data?.tasks || []
    return overdueOnly ? t.filter(x => x.overdue) : t
  }, [data, overdueOnly])

  const cases  = useMemo(() => {
    const c = data?.cases || []
    return overdueOnly ? c.filter(x => x.daysOpen >= 7) : c
  }, [data, overdueOnly])

  const leads  = data?.leads  || []
  const deals  = data?.deals  || []

  // Group tasks by responsible user
  const tasksByUser = useMemo(() => {
    const map = new Map()
    for (const t of tasks) {
      const tr = t.tracker
      const phase = tr.phase
      const responsible =
        phase === 'Training'        ? tr.trainingSpecialist :
        phase === 'AccountManagement' || phase === 'Expired' ? tr.accountManager :
        tr.onboardingSpecialist
      const uid  = responsible?.id   || 'unassigned'
      const name = responsible?.name || 'Unassigned'
      if (!map.has(uid)) map.set(uid, { name, items: [] })
      map.get(uid).items.push(t)
    }
    return [...map.entries()]
  }, [tasks])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-xl px-4 py-3">
        <select value={userId} onChange={e => setUserId(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">All Team Members</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select value={module} onChange={e => setModule(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {Object.entries(MODULE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-auto">
          <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)}
            className="accent-indigo-600 w-4 h-4" />
          Overdue only
        </label>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── Onboarding Tasks ───────────────────────────── */}
          {(module === 'all' || module === 'onboarding') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <SectionHeader title="Onboarding Tasks" count={tasks.length} icon="🏗️" />
              {tasksByUser.length === 0 ? <EmptyRow text="No pending tasks" /> : (
                <div className="space-y-4">
                  {tasksByUser.map(([uid, { name, items }]) => (
                    <div key={uid}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{name}</p>
                      <div className="space-y-1.5">
                        {items.map(t => (
                          <div key={t.id}
                            onClick={() => router.push(`/onboarding/${t.tracker.id}`)}
                            className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer hover:border-indigo-300 transition-colors ${t.overdue ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                            <span className={`mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${t.overdue ? 'bg-red-500' : 'bg-gray-300'}`} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-800 truncate">{t.title}</p>
                              <p className="text-gray-400 mt-0.5">
                                {t.tracker.account?.name} · {PHASE_LABELS[t.tracker.phase] || t.tracker.phase}
                                {t.overdue && <span className="ml-1 text-red-500 font-semibold">· Overdue</span>}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Open Cases ─────────────────────────────────── */}
          {(module === 'all' || module === 'cases') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <SectionHeader title="Open Cases" count={cases.length} icon="🎫" />
              {cases.length === 0 ? <EmptyRow text="No open cases" /> : (
                <div className="space-y-2">
                  {cases.map(c => (
                    <div key={c.id}
                      onClick={() => router.push(`/cases/${c.id}`)}
                      className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border text-xs cursor-pointer hover:border-indigo-300 transition-colors ${c.daysOpen >= 14 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{c.title}</p>
                        <p className="text-gray-400 mt-0.5">
                          {c.account?.name || 'No account'} · Opened by {c.openedBy?.name}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                        <span className={`font-medium ${c.daysOpen >= 14 ? 'text-red-500' : 'text-gray-400'}`}>
                          {c.daysOpen}d open
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Active Leads ───────────────────────────────── */}
          {(module === 'all' || module === 'pipeline') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <SectionHeader title="Active Leads" count={leads.length} icon="🎯" />
              {leads.length === 0 ? <EmptyRow text="No active leads" /> : (
                <div className="space-y-1.5">
                  {leads.map(l => (
                    <div key={l.id}
                      onClick={() => router.push(`/pipeline/${l.id}`)}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-xs cursor-pointer hover:border-indigo-300 transition-colors">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{l.companyName}</p>
                        <p className="text-gray-400 mt-0.5">{l.country?.name} · Owner: {l.owner?.name || '—'}</p>
                      </div>
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                        {STAGE_LABELS[l.stage] || l.stage}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Deals ─────────────────────────────────────── */}
          {(module === 'all' || module === 'invoicing') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <SectionHeader title="Deals" count={deals.length} icon="💼" />
              {deals.length === 0 ? <EmptyRow text="No deals" /> : (
                <div className="space-y-1.5">
                  {deals.map(d => {
                    const hasUnpaid = d.invoices.some(i => i.status !== 'Paid')
                    return (
                      <div key={d.id}
                        onClick={() => router.push('/invoicing/invoices')}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-xs cursor-pointer hover:border-indigo-300 transition-colors">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{d.account?.name || d.accountName}</p>
                          <p className="text-gray-400 mt-0.5">Agent: {d.agent?.name || '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-gray-500">{d.invoices.length} invoice{d.invoices.length !== 1 ? 's' : ''}</span>
                          {hasUnpaid && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Unpaid</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
