'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHANNEL_LABELS = {
  Whatsapp:        'WhatsApp',
  Call:            'Call',
  VirtualMeeting:  'Virtual Meeting',
  PhysicalMeeting: 'Physical Meeting',
  Email:           'Email',
  Other:           'Other',
}

// Full label map used for display/badges (covers all enum values including legacy)
export const OBJECTIVE_LABELS = {
  Inquiry:          'Inquiry',
  Onboarding:       'Onboarding',
  Training:         'Training',
  BugReport:        'Bug Report',
  TrainingRequest:  'Training Request',
  NewRequirement:   'New Requirement',
  TechnicalRequest: 'Technical Request',
  GlobalOutage:     'Global Outage',
}

// Subset shown in the engagement log creation / edit form
export const LOG_FORM_OBJECTIVES = {
  Inquiry:    'Inquiry',
  Onboarding: 'Onboarding',
  Training:   'Training',
}

// ─── Duration helper ──────────────────────────────────────────────────────────

export function calcDuration(startTime, endTime) {
  if (!startTime || !endTime) return null
  const ms = new Date(endTime) - new Date(startTime)
  if (ms <= 0) return null
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

const CHANNEL_COLORS = {
  Whatsapp:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  Call:            'bg-blue-50 text-blue-700 border-blue-200',
  VirtualMeeting:  'bg-violet-50 text-violet-700 border-violet-200',
  PhysicalMeeting: 'bg-amber-50 text-amber-700 border-amber-200',
  Email:           'bg-sky-50 text-sky-700 border-sky-200',
  Other:           'bg-gray-50 text-gray-600 border-gray-200',
}

const OBJECTIVE_COLORS = {
  Inquiry:          'bg-blue-50 text-blue-700 border-blue-200',
  Onboarding:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  Training:         'bg-amber-50 text-amber-700 border-amber-200',
  BugReport:        'bg-red-50 text-red-700 border-red-200',
  TrainingRequest:  'bg-amber-50 text-amber-700 border-amber-200',
  NewRequirement:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  TechnicalRequest: 'bg-violet-50 text-violet-700 border-violet-200',
  GlobalOutage:     'bg-red-100 text-red-800 border-red-200',
}

function ChannelBadge({ value }) {
  const cls = CHANNEL_COLORS[value] || CHANNEL_COLORS.Other
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {CHANNEL_LABELS[value] || value}
    </span>
  )
}

function ObjectiveBadge({ value }) {
  const cls = OBJECTIVE_COLORS[value] || 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {OBJECTIVE_LABELS[value] || value}
    </span>
  )
}

// ─── Log Form Modal ───────────────────────────────────────────────────────────

function toTimeInput(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function combineDateAndTime(date, time) {
  if (!date || !time) return null
  return new Date(`${date}T${time}:00`).toISOString()
}

function LogModal({ accounts, initial, onClose, onSave, isSaving }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    accountId: initial?.accountId ?? '',
    channel:   initial?.channel   ?? '',
    objective: initial?.objective ?? '',
    notes:     initial?.notes     ?? '',
    loggedAt:  initial?.loggedAt
      ? new Date(initial.loggedAt).toISOString().slice(0, 10)
      : today,
    startTime: initial?.startTime ? toTimeInput(initial.startTime) : '',
    endTime:   initial?.endTime   ? toTimeInput(initial.endTime)   : '',
  })
  const [accountSearch, setAccountSearch] = useState(
    initial?.account?.name ?? ''
  )
  const [showDropdown, setShowDropdown] = useState(false)

  const filteredAccounts = useMemo(() =>
    accounts.filter((a) =>
      a.name.toLowerCase().includes(accountSearch.toLowerCase())
    ).slice(0, 8),
    [accounts, accountSearch]
  )

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  const duration = calcDuration(
    form.loggedAt && form.startTime ? combineDateAndTime(form.loggedAt, form.startTime) : null,
    form.loggedAt && form.endTime   ? combineDateAndTime(form.loggedAt, form.endTime)   : null,
  )

  const valid = form.accountId && form.channel && form.objective && form.loggedAt

  function handleSave() {
    onSave({
      ...form,
      startTime: form.startTime ? combineDateAndTime(form.loggedAt, form.startTime) : null,
      endTime:   form.endTime   ? combineDateAndTime(form.loggedAt, form.endTime)   : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {initial ? 'Edit Interaction' : 'Log Interaction'}
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Account */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Account <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={accountSearch}
              onChange={(e) => { setAccountSearch(e.target.value); setShowDropdown(true); set('accountId', '') }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search account…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
            />
            {showDropdown && filteredAccounts.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                {filteredAccounts.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        set('accountId', a.id)
                        setAccountSearch(a.name)
                        setShowDropdown(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F5F2FF] hover:text-[#5061F6] transition-colors"
                    >
                      {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Event Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Event Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.loggedAt}
                max={today}
                onChange={(e) => set('loggedAt', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                End Time
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
              />
            </div>
          </div>
          {duration && (
            <p className="text-xs text-indigo-600 font-medium -mt-1">
              ⏱ Duration: {duration}
            </p>
          )}

          {/* Channel + Objective */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Channel <span className="text-red-400">*</span>
              </label>
              <select
                value={form.channel}
                onChange={(e) => set('channel', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
              >
                <option value="">Select…</option>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Objective <span className="text-red-400">*</span>
              </label>
              <select
                value={form.objective}
                onChange={(e) => set('objective', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
              >
                <option value="">Select…</option>
                {Object.entries(LOG_FORM_OBJECTIVES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Summary of the interaction…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!valid || isSaving}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#5061F6] hover:bg-[#3b4cc4] disabled:opacity-40 rounded-xl transition-colors"
          >
            {isSaving ? 'Saving…' : initial ? 'Save Changes' : 'Log Interaction'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function fmtTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function exportCsv(logs) {
  function cell(v) {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const headers = ['Date', 'Start Time', 'End Time', 'Duration', 'Account', 'Channel', 'Objective', 'Notes', 'Logged By']
  const rows = logs.map((r) => [
    new Date(r.loggedAt).toLocaleDateString('en-GB'),
    fmtTime(r.startTime),
    fmtTime(r.endTime),
    calcDuration(r.startTime, r.endTime) ?? '',
    r.account?.name,
    CHANNEL_LABELS[r.channel]     || r.channel,
    OBJECTIVE_LABELS[r.objective] || r.objective,
    r.notes,
    r.loggedBy?.name || r.loggedBy?.email,
  ].map(cell).join(','))
  const csv = [headers.map(cell).join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'engagement-logs.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EngagementLogsPage() {
  const qc = useQueryClient()

  // ── Filters ──
  const [accountSearch, setAccountSearch] = useState('')
  const [filterChannel,   setFilterChannel]   = useState('')
  const [filterObjective, setFilterObjective] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')

  // ── Modal ──
  const [modal, setModal] = useState(null) // null | 'create' | { ...log }

  // ── Data ──
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-list'],
    queryFn:  () => fetch('/api/accounts').then((r) => r.json()),
  })

  const params = new URLSearchParams()
  if (filterChannel)   params.set('channel',   filterChannel)
  if (filterObjective) params.set('objective',  filterObjective)
  if (filterFrom)      params.set('from',       filterFrom)
  if (filterTo)        params.set('to',         filterTo)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['engagement-logs', filterChannel, filterObjective, filterFrom, filterTo],
    queryFn:  () => fetch(`/api/engagement-logs?${params}`).then((r) => r.json()),
  })

  // ── Filtered client-side by account name search ──
  const displayed = useMemo(() => {
    if (!accountSearch.trim()) return logs
    const q = accountSearch.toLowerCase()
    return logs.filter((l) => l.account?.name?.toLowerCase().includes(q))
  }, [logs, accountSearch])

  // ── KPIs ──
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const logsThisMonth  = logs.filter((l) => new Date(l.loggedAt) >= thisMonthStart).length

  const channelCounts = logs.reduce((acc, l) => {
    acc[l.channel] = (acc[l.channel] || 0) + 1; return acc
  }, {})
  const topChannel = Object.keys(channelCounts).sort((a, b) => channelCounts[b] - channelCounts[a])[0]

  const objectiveCounts = logs.reduce((acc, l) => {
    acc[l.objective] = (acc[l.objective] || 0) + 1; return acc
  }, {})
  const topObjective = Object.keys(objectiveCounts).sort((a, b) => objectiveCounts[b] - objectiveCounts[a])[0]

  // Total time logged this month (mins)
  const totalMinsThisMonth = logs
    .filter((l) => new Date(l.loggedAt) >= thisMonthStart && l.startTime && l.endTime)
    .reduce((sum, l) => {
      const ms = new Date(l.endTime) - new Date(l.startTime)
      return ms > 0 ? sum + ms / 60000 : sum
    }, 0)
  const totalTimeLabel = totalMinsThisMonth === 0 ? '—'
    : totalMinsThisMonth < 60 ? `${Math.round(totalMinsThisMonth)} min`
    : `${Math.floor(totalMinsThisMonth / 60)}h ${Math.round(totalMinsThisMonth % 60)}min`

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data) => fetch('/api/engagement-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engagement-logs'] }); setModal(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/engagement-logs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engagement-logs'] }); setModal(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/engagement-logs/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engagement-logs'] }),
  })

  function handleSave(form) {
    if (modal === 'create') {
      createMutation.mutate(form)
    } else {
      updateMutation.mutate({ id: modal.id, data: form })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const hasFilters = filterChannel || filterObjective || filterFrom || filterTo

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Engagement Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Record every client interaction — calls, meetings, WhatsApp and more.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {logs.length > 0 && (
            <button
              onClick={() => exportCsv(displayed)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#5061F6] bg-white border border-[#5061F6]/20 rounded-lg hover:bg-[#F5F2FF] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" d="M12 3v13M7 11l5 5 5-5M3 21h18" />
              </svg>
              Export CSV
            </button>
          )}
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#5061F6] hover:bg-[#3b4cc4] rounded-xl transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
            Log Interaction
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Logs"         value={logs.length}   format="integer" subLabel="all time" />
        <KPICard label="This Month"         value={logsThisMonth} format="integer" subLabel="interactions" accent="#5061F6" />
        <KPICard label="Time Logged (Month)" value={totalTimeLabel} format="text"   subLabel="total interaction time" accent="#5061F6" />
        <KPICard
          label="Top Channel"
          value={topChannel ? CHANNEL_LABELS[topChannel] : '—'}
          format="text"
          subLabel={topChannel ? `${channelCounts[topChannel]} logs` : 'no data'}
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>

        <input
          type="text"
          placeholder="Search account…"
          value={accountSearch}
          onChange={(e) => setAccountSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6] w-44"
        />

        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
        >
          <option value="">All Channels</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select
          value={filterObjective}
          onChange={(e) => setFilterObjective(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
        >
          <option value="">All Objectives</option>
          {Object.entries(OBJECTIVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">From</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">To</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          />
        </div>

        {(hasFilters || accountSearch) && (
          <button
            onClick={() => { setFilterChannel(''); setFilterObjective(''); setFilterFrom(''); setFilterTo(''); setAccountSearch('') }}
            className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 text-center">
          <p className="text-sm text-gray-400">
            {hasFilters || accountSearch ? 'No logs match your filters.' : 'No interactions logged yet. Click "Log Interaction" to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
                {['Date', 'Duration', 'Account', 'Channel', 'Objective', 'Notes', 'Logged By', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map((log) => (
                <tr key={log.id} className="hover:bg-[#F5F2FF]/40 transition-colors group">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(log.loggedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {log.startTime && (
                      <span className="block text-xs text-gray-400">
                        {fmtTime(log.startTime)}{log.endTime ? ` – ${fmtTime(log.endTime)}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {calcDuration(log.startTime, log.endTime)
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">⏱ {calcDuration(log.startTime, log.endTime)}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {log.account?.id
                      ? <a href={`/accounts/${log.account.id}`} className="hover:text-[#5061F6] hover:underline">{log.account.name}</a>
                      : log.account?.name || '—'}
                  </td>
                  <td className="px-4 py-3"><ChannelBadge value={log.channel} /></td>
                  <td className="px-4 py-3"><ObjectiveBadge value={log.objective} /></td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    {log.notes
                      ? <span className="line-clamp-2 leading-snug">{log.notes}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {log.loggedBy?.name || log.loggedBy?.email || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setModal(log)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#5061F6] hover:bg-[#F5F2FF] rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this log entry?')) deleteMutation.mutate(log.id)
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <LogModal
          accounts={accounts}
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  )
}
