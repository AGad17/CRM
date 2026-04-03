'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { MentionTextarea } from '@/components/ui/MentionTextarea'
import { RenderedNote } from '@/components/ui/RenderedNote'
import {
  CHANNEL_LABELS, OBJECTIVE_LABELS, STATUS_LABELS, STATUS_COLORS, OBJECTIVE_COLORS,
  CASE_FORM_OBJECTIVES,
} from '../page'

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

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Edit Case Modal (inline in detail page) ─────────────────────────────────

function EditCaseModal({ c, accounts, staffUsers, onClose, onSave, isPending }) {
  const [form, setForm] = useState({
    accountId:           c.account ? String(c.account.id) : '',
    title:               c.title || '',
    channel:             c.channel || '',
    objective:           c.objective || '',
    description:         c.description || '',
    assignedToId:        c.assignedTo?.id || '',
    dueDate:             c.dueDate ? new Date(c.dueDate).toISOString().split('T')[0] : '',
    reminderHoursBefore: c.reminderHoursBefore?.toString() || '',
  })
  const [search, setSearch] = useState(c.account?.name || '')

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  )
  const valid = form.title && form.channel && form.objective

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Edit Case #{c.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Account</label>
          <input
            type="text"
            placeholder="Search account…"
            value={search}
            onChange={e => { setSearch(e.target.value); setForm(f => ({ ...f, accountId: '' })) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && !form.accountId && (
            <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-40 bg-white shadow-sm">
              {filtered.slice(0, 20).map(a => (
                <button key={a.id} type="button"
                  onClick={() => { setForm(f => ({ ...f, accountId: String(a.id) })); setSearch(a.name) }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-indigo-50"
                >
                  {a.name}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No accounts found</p>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
          <input type="text" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Channel <span className="text-red-500">*</span></label>
            <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">Select…</option>
              {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objective <span className="text-red-500">*</span></label>
            <select value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">Select…</option>
              {Object.entries(CASE_FORM_OBJECTIVES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
          <select value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            <option value="">— Unassigned —</option>
            {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value, reminderHoursBefore: e.target.value ? f.reminderHoursBefore : '' }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          {form.dueDate && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Remind before due date</label>
              <select
                value={form.reminderHoursBefore}
                onChange={e => setForm(f => ({ ...f, reminderHoursBefore: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">— No reminder —</option>
                <option value="24">24 hours before</option>
                <option value="48">48 hours before</option>
                <option value="72">72 hours before</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || isPending}
            className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Void Modal ───────────────────────────────────────────────────────────────

function VoidModal({ c, onClose, onConfirm, isPending }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Void Case #{c.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <p className="text-sm text-gray-600">
          Voiding marks this case as raised by mistake. It will be kept as a record but excluded from open case counts.
        </p>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Reason <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this case being voided? (e.g. misunderstood issue, wrong account, duplicate)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isPending}
            className="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50"
          >
            {isPending ? 'Voiding…' : 'Void Case'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const { id } = useParams()
  const qc     = useQueryClient()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const isAdmin       = session?.user?.role === 'CCO_ADMIN'

  const [showFollowUp,   setShowFollowUp]   = useState(false)
  const [fuForm,         setFuForm]         = useState({ channel: '', actionTaken: '', notes: '', loggedAt: new Date().toISOString().split('T')[0] })
  const [linkingOutage,  setLinkingOutage]  = useState(false)
  const [selectedOutage, setSelectedOutage] = useState('')
  const [showEdit,       setShowEdit]       = useState(false)
  const [showVoid,       setShowVoid]       = useState(false)

  const { data: c, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => fetch(`/api/cases/${id}`).then(r => r.json()),
  })

  // Scroll to a specific follow-up when navigated via notification deep-link (#followup-{id})
  useEffect(() => {
    if (!c?.followUps?.length) return
    const hash = window.location.hash
    if (!hash.startsWith('#followup-')) return
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [c])

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetch('/api/users/staff').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: () => fetch('/api/accounts?limit=1000').then(r => r.json()).then(d => d.accounts || d),
    staleTime: 5 * 60 * 1000,
  })

  const { data: allOutages = [] } = useQuery({
    queryKey: ['all-outages'],
    queryFn: () => fetch('/api/outages').then(r => r.ok ? r.json() : []).catch(() => []),
    staleTime: 30 * 1000,
  })

  const linkOutageMutation = useMutation({
    mutationFn: (outageId) =>
      fetch(`/api/cases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'update', outageId: outageId || null }),
      }).then(r => r.json()),
    onSuccess: () => {
      setLinkingOutage(false)
      qc.invalidateQueries({ queryKey: ['case', id] })
      qc.invalidateQueries({ queryKey: ['outage'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status) =>
      fetch(`/api/cases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'updateStatus', status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case', id] }),
  })

  const editMutation = useMutation({
    mutationFn: (body) =>
      fetch(`/api/cases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'update', ...body }),
      }).then(r => r.json()),
    onSuccess: () => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['case', id] }) },
  })

  const voidMutation = useMutation({
    mutationFn: (reason) =>
      fetch(`/api/cases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'void', reason }),
      }).then(r => r.json()),
    onSuccess: () => { setShowVoid(false); qc.invalidateQueries({ queryKey: ['case', id] }) },
  })

  const followUpMutation = useMutation({
    mutationFn: (body) =>
      fetch(`/api/cases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'addFollowUp', ...body }),
      }).then(r => r.json()),
    onSuccess: () => {
      setShowFollowUp(false)
      setFuForm({ channel: '', actionTaken: '', notes: '', loggedAt: new Date().toISOString().split('T')[0] })
      qc.invalidateQueries({ queryKey: ['case', id] })
    },
  })

  const deleteFuMutation = useMutation({
    mutationFn: (fid) => fetch(`/api/cases/${id}/follow-ups/${fid}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case', id] }),
  })

  const voidFuMutation = useMutation({
    mutationFn: (followUpId) =>
      fetch(`/api/cases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'voidFollowUp', followUpId }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case', id] }),
  })

  if (isLoading) return <div className="animate-pulse h-96 bg-gray-100 rounded-2xl" />
  if (!c || c.error) return <div className="text-red-500">Case not found</div>

  const ttr      = formatTTR(c.openedAt, c.resolvedAt)
  const isOpen   = c.status === 'Open' || c.status === 'Escalated'
  const isClosed = c.status === 'Resolved' || c.status === 'ClosedUnresolved'
  const isVoided = c.status === 'Voided'
  const canEdit  = !isVoided
  const canVoid  = isOpen

  // ── Build merged timeline ────────────────────────────────────────────────
  // Combine follow-ups + activity log (edits/voids) sorted by date
  const timelineEvents = [
    ...(c.followUps || []).map(fu => ({ type: 'followup', date: new Date(fu.loggedAt), data: fu })),
    ...(c.activityLog || [])
      .filter(l => l.action === 'case_edited' || l.action === 'case_voided')
      .map(l => ({ type: 'activity', date: new Date(l.createdAt), data: l })),
  ].sort((a, b) => a.date - b.date)

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumb items={[{ label: 'Cases', href: '/cases' }, { label: `Case #${c.id}` }]} />

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 flex-1">
            <h2 className={`text-lg font-bold text-gray-900 ${isVoided ? 'line-through text-gray-400' : ''}`}>{c.title}</h2>
            <div className="flex items-center gap-3 flex-wrap text-sm text-gray-500">
              {c.account && (
                <Link href={`/accounts/${c.account.id}`} className="text-indigo-600 hover:underline font-medium">
                  {c.account.name}
                </Link>
              )}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${OBJECTIVE_COLORS[c.objective] || 'bg-gray-50 text-gray-500'}`}>
                {OBJECTIVE_LABELS[c.objective] || c.objective}
              </span>
              <span className="text-gray-400">Opened {fmtDate(c.openedAt)}</span>
              <span className="text-gray-400">by {c.openedBy?.name || c.openedBy?.email}</span>
              {c.dueDate && (() => {
                const due = new Date(c.dueDate)
                const isOverdue = due < new Date() && !['Resolved', 'ClosedUnresolved', 'Voided'].includes(c.status)
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                    {isOverdue ? '⚠ ' : ''}Due {fmtDate(c.dueDate)}{isOverdue ? ' · Overdue' : ''}
                  </span>
                )
              })()}
              {c.reminderHoursBefore && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                  🔔 {c.reminderHoursBefore}h reminder
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Assigned to: <span className="font-medium text-gray-700">
                {c.assignedTo ? (c.assignedTo.name || c.assignedTo.email) : 'Unassigned'}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[c.status]}`}>
              {STATUS_LABELS[c.status]}
            </span>
            {/* Edit / Void buttons */}
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-400 px-2.5 py-1 rounded-lg"
                >
                  ✏️ Edit
                </button>
              )}
              {canVoid && (
                <button
                  onClick={() => setShowVoid(true)}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1 rounded-lg"
                >
                  ⊘ Void
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Void reason banner */}
        {isVoided && c.voidReason && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
            <span className="font-medium">Void reason:</span> {c.voidReason}
          </div>
        )}

        {/* Linked outage */}
        <div className="border-t border-gray-100 pt-3">
          {c.outage ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Linked outage:</span>
              <Link
                href={`/outages/${c.outage.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full hover:bg-red-100"
              >
                🔴 {c.outage.title}
                {c.outage.outageStatus === 'Active' && <span className="text-red-400">· Active</span>}
              </Link>
              {!linkingOutage && (
                <button
                  onClick={() => { setSelectedOutage(c.outage.id); setLinkingOutage(true) }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Change
                </button>
              )}
              {!linkingOutage && (
                <button
                  onClick={() => linkOutageMutation.mutate(null)}
                  disabled={linkOutageMutation.isPending}
                  className="text-xs text-red-300 hover:text-red-500 underline"
                >
                  Unlink
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">No linked outage.</span>
              {!linkingOutage && !isVoided && (
                <button
                  onClick={() => { setSelectedOutage(''); setLinkingOutage(true) }}
                  className="text-xs text-indigo-500 hover:text-indigo-700 underline"
                >
                  Link to outage
                </button>
              )}
            </div>
          )}
          {linkingOutage && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <select
                value={selectedOutage}
                onChange={e => setSelectedOutage(e.target.value)}
                className="border border-orange-200 bg-orange-50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="">— No outage —</option>
                {allOutages.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.outageStatus === 'Active' ? '🔴 ' : '✓ '}{o.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => linkOutageMutation.mutate(selectedOutage || null)}
                disabled={linkOutageMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
              >
                {linkOutageMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setLinkingOutage(false)}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isOpen && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={() => statusMutation.mutate('Resolved')}
              disabled={statusMutation.isPending}
              className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              ✓ Mark Resolved
            </button>
            {c.status === 'Open' && (
              <button
                onClick={() => statusMutation.mutate('Escalated')}
                disabled={statusMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium"
              >
                ↑ Escalate
              </button>
            )}
            {c.status === 'Escalated' && (
              <button
                onClick={() => statusMutation.mutate('Open')}
                disabled={statusMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
              >
                ↓ De-escalate
              </button>
            )}
            <button
              onClick={() => statusMutation.mutate('ClosedUnresolved')}
              disabled={statusMutation.isPending}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
            >
              ✕ Close Unresolved
            </button>
          </div>
        )}

        {isClosed && ttr && (
          <div className="flex items-center gap-4 text-sm pt-1">
            <span className="text-gray-400">Resolved: <span className="text-gray-700 font-medium">{fmtDate(c.resolvedAt)}</span></span>
            <span className="text-gray-400">Time to resolve: <span className="text-gray-700 font-medium">{ttr}</span></span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-0">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity Timeline</h3>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" />

          <div className="space-y-0">
            {/* Opening entry */}
            <div className="relative flex gap-4 pb-5">
              <div className="relative z-10 w-6 h-6 rounded-full bg-indigo-100 border-2 border-indigo-300 flex-shrink-0 flex items-center justify-center">
                <span className="text-xs">📋</span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-gray-700">Case Opened</span>
                  <span className="text-xs text-gray-400">by {c.openedBy?.name || c.openedBy?.email}</span>
                  <span className="text-xs text-gray-400">· {fmtDate(c.openedAt)}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {CHANNEL_LABELS[c.channel] || c.channel}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${OBJECTIVE_COLORS[c.objective]}`}>
                    {OBJECTIVE_LABELS[c.objective] || c.objective}
                  </span>
                </div>
                {c.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{c.description}</p>
                )}
              </div>
            </div>

            {/* Merged follow-ups + edit/void activity */}
            {timelineEvents.map((ev, i) => {
              if (ev.type === 'followup') {
                const fu       = ev.data
                const isVoided = !!fu.voidedAt
                const canVoid  = !isVoided && (fu.author?.id === currentUserId || fu.authorId === currentUserId || isAdmin)
                return (
                  <div key={`fu-${fu.id}`} id={`followup-${fu.id}`} className={`relative flex gap-4 pb-5 group scroll-mt-24 ${isVoided ? 'opacity-70' : ''}`}>
                    <div className={`relative z-10 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isVoided ? 'bg-red-50 border-red-200' : 'bg-gray-100 border-gray-200'}`}>
                      <span className="text-xs">{isVoided ? '⊘' : '💬'}</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-sm font-semibold ${isVoided ? 'text-gray-400' : 'text-gray-700'}`}>Follow-up</span>
                        <span className="text-xs text-gray-400">by {fu.author?.name || fu.author?.email}</span>
                        <span className="text-xs text-gray-400">· {fmtDate(fu.loggedAt)}</span>
                        {canVoid && (
                          <button
                            onClick={() => { if (confirm('Void this follow-up? It will remain visible with a strikethrough.')) voidFuMutation.mutate(fu.id) }}
                            className="ml-auto text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Void follow-up"
                          >⊘</button>
                        )}
                      </div>
                      {fu.channel && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mb-1 ${isVoided ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700'}`}>
                          {CHANNEL_LABELS[fu.channel] || fu.channel}
                        </span>
                      )}
                      {fu.actionTaken && (
                        <p className={`text-xs mb-1 ${isVoided ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                          <span className={`font-medium ${isVoided ? 'text-gray-400' : 'text-gray-600'}`}>Action taken:</span> {fu.actionTaken}
                        </p>
                      )}
                      {fu.notes && (
                        <RenderedNote content={fu.notes} className={`text-sm rounded-lg px-3 py-2 ${isVoided ? 'text-gray-400 line-through bg-gray-50' : 'text-gray-600 bg-gray-50'}`} />
                      )}
                      {isVoided && (
                        <p className="text-xs text-red-400 mt-1">Voided by {fu.voidedByName} · {new Date(fu.voidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      )}
                    </div>
                  </div>
                )
              }

              if (ev.type === 'activity') {
                const log = ev.data
                const isEdit  = log.action === 'case_edited'
                const isVoid  = log.action === 'case_voided'
                return (
                  <div key={`al-${log.id}`} className="relative flex gap-4 pb-5">
                    <div className={`relative z-10 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${isVoid ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
                      <span className="text-xs">{isVoid ? '⊘' : '✏️'}</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-sm font-semibold ${isVoid ? 'text-red-600' : 'text-amber-700'}`}>
                          {isVoid ? 'Case Voided' : 'Case Edited'}
                        </span>
                        <span className="text-xs text-gray-400">by {log.actorName}</span>
                        <span className="text-xs text-gray-400">· {fmtDateTime(log.createdAt)}</span>
                      </div>
                      {isEdit && log.meta?.changes?.length > 0 && (
                        <ul className="text-xs text-gray-600 bg-amber-50 rounded-lg px-3 py-2 space-y-0.5">
                          {log.meta.changes.map((ch, j) => (
                            <li key={j}>
                              <span className="font-medium text-gray-700">{ch.field}:</span>{' '}
                              <span className="line-through text-gray-400">{ch.from}</span>
                              {' → '}
                              <span className="text-gray-800">{ch.to}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {isVoid && log.meta?.reason && (
                        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                          <span className="font-medium">Reason:</span> {log.meta.reason}
                        </p>
                      )}
                    </div>
                  </div>
                )
              }

              return null
            })}

            {/* Resolved / Closed / Voided entry */}
            {(isClosed || isVoided) && (
              <div className="relative flex gap-4">
                <div className={`relative z-10 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${isVoided ? 'bg-red-50 border-red-300' : 'bg-emerald-100 border-emerald-300'}`}>
                  <span className="text-xs">
                    {c.status === 'Resolved' ? '✓' : c.status === 'Voided' ? '⊘' : '✕'}
                  </span>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700">
                      {c.status === 'Resolved' ? 'Case Resolved' : c.status === 'Voided' ? 'Case Voided' : 'Case Closed – Unresolved'}
                    </span>
                    {c.resolvedAt && <span className="text-xs text-gray-400">· {fmtDate(c.resolvedAt)}</span>}
                    {ttr && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">TTR: {ttr}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Follow-up form — only for non-voided, non-closed cases */}
        {isOpen && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {showFollowUp ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Add Follow-up</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Channel (optional)</label>
                    <select
                      value={fuForm.channel}
                      onChange={e => setFuForm(f => ({ ...f, channel: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    >
                      <option value="">— None —</option>
                      {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={fuForm.loggedAt}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setFuForm(f => ({ ...f, loggedAt: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Action Taken</label>
                  <input
                    type="text"
                    value={fuForm.actionTaken}
                    onChange={e => setFuForm(f => ({ ...f, actionTaken: e.target.value }))}
                    placeholder="e.g. Escalated to tier-2, Sent update to client…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <MentionTextarea
                    value={fuForm.notes}
                    onChange={(v) => setFuForm(f => ({ ...f, notes: v }))}
                    rows={2}
                    placeholder="Additional context… use @ to mention a teammate"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowFollowUp(false); setFuForm({ channel: '', actionTaken: '', notes: '', loggedAt: new Date().toISOString().split('T')[0] }) }}
                    className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => followUpMutation.mutate(fuForm)}
                    disabled={!fuForm.loggedAt || followUpMutation.isPending}
                    className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
                  >
                    {followUpMutation.isPending ? 'Saving…' : '+ Add Follow-up'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowFollowUp(true)}
                className="text-sm text-indigo-500 hover:text-indigo-700 font-medium"
              >
                + Add Follow-up
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditCaseModal
          c={c}
          accounts={accounts}
          staffUsers={staffUsers}
          onClose={() => setShowEdit(false)}
          onSave={(form) => editMutation.mutate(form)}
          isPending={editMutation.isPending}
        />
      )}

      {/* Void Modal */}
      {showVoid && (
        <VoidModal
          c={c}
          onClose={() => setShowVoid(false)}
          onConfirm={(reason) => voidMutation.mutate(reason)}
          isPending={voidMutation.isPending}
        />
      )}
    </div>
  )
}
