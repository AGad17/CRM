'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { CHANNEL_LABELS, OBJECTIVE_LABELS, STATUS_LABELS, STATUS_COLORS, OBJECTIVE_COLORS } from '../page'

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

export default function CaseDetailPage() {
  const { id } = useParams()
  const qc     = useQueryClient()

  const [showFollowUp,  setShowFollowUp]  = useState(false)
  const [fuForm,        setFuForm]        = useState({ channel: '', actionTaken: '', notes: '', loggedAt: new Date().toISOString().split('T')[0] })
  const [linkingOutage, setLinkingOutage] = useState(false)
  const [selectedOutage, setSelectedOutage] = useState('')

  const { data: c, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => fetch(`/api/cases/${id}`).then(r => r.json()),
  })

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetch('/api/users/staff').then(r => r.json()),
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

  if (isLoading) return <div className="animate-pulse h-96 bg-gray-100 rounded-2xl" />
  if (!c || c.error) return <div className="text-red-500">Case not found</div>

  const ttr      = formatTTR(c.openedAt, c.resolvedAt)
  const isOpen   = c.status === 'Open' || c.status === 'Escalated'
  const isClosed = c.status === 'Resolved' || c.status === 'ClosedUnresolved'

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumb items={[{ label: 'Cases', href: '/cases' }, { label: `Case #${c.id}` }]} />

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 flex-1">
            <h2 className="text-lg font-bold text-gray-900">{c.title}</h2>
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
            </div>
            <p className="text-sm text-gray-500">
              Assigned to: <span className="font-medium text-gray-700">
                {c.assignedTo ? (c.assignedTo.name || c.assignedTo.email) : 'Unassigned'}
              </span>
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[c.status]}`}>
            {STATUS_LABELS[c.status]}
          </span>
        </div>

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
              {!linkingOutage && (
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
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700`}>
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

            {/* Follow-ups */}
            {c.followUps?.map(fu => (
              <div key={fu.id} className="relative flex gap-4 pb-5 group">
                <div className="relative z-10 w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-200 flex-shrink-0 flex items-center justify-center">
                  <span className="text-xs">💬</span>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-700">Follow-up</span>
                    <span className="text-xs text-gray-400">by {fu.author?.name || fu.author?.email}</span>
                    <span className="text-xs text-gray-400">· {fmtDate(fu.loggedAt)}</span>
                    <button
                      onClick={() => { if (confirm('Delete this follow-up?')) deleteFuMutation.mutate(fu.id) }}
                      className="ml-auto text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      🗑
                    </button>
                  </div>
                  {fu.channel && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mb-1">
                      {CHANNEL_LABELS[fu.channel] || fu.channel}
                    </span>
                  )}
                  {fu.actionTaken && (
                    <p className="text-xs text-gray-500 mb-1">
                      <span className="font-medium text-gray-600">Action taken:</span> {fu.actionTaken}
                    </p>
                  )}
                  {fu.notes && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{fu.notes}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Resolved entry */}
            {isClosed && (
              <div className="relative flex gap-4">
                <div className="relative z-10 w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-300 flex-shrink-0 flex items-center justify-center">
                  <span className="text-xs">{c.status === 'Resolved' ? '✓' : '✕'}</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700">
                      {c.status === 'Resolved' ? 'Case Resolved' : 'Case Closed – Unresolved'}
                    </span>
                    <span className="text-xs text-gray-400">· {fmtDate(c.resolvedAt)}</span>
                    {ttr && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">TTR: {ttr}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Follow-up form */}
        {!isClosed && (
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
                  <textarea
                    value={fuForm.notes}
                    onChange={e => setFuForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="Additional context…"
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
    </div>
  )
}
