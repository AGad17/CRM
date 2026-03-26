'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { CHANNEL_LABELS, STATUS_LABELS, STATUS_COLORS, OBJECTIVE_COLORS } from '../../cases/page'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(openedAt, resolvedAt) {
  if (!resolvedAt) return null
  const ms  = new Date(resolvedAt) - new Date(openedAt)
  const hrs = ms / (1000 * 60 * 60)
  if (hrs < 1) return `${Math.round(hrs * 60)}m`
  if (hrs < 24) return `${Math.round(hrs)}h`
  return `${Math.floor(hrs / 24)}d ${Math.round(hrs % 24)}h`
}

export default function OutageDetailPage() {
  const { id } = useParams()
  const qc     = useQueryClient()

  const [showFollowUp, setShowFollowUp] = useState(false)
  const [fuForm, setFuForm] = useState({ channel: '', actionTaken: '', notes: '', loggedAt: new Date().toISOString().split('T')[0] })

  const { data: outage, isLoading } = useQuery({
    queryKey: ['outage', id],
    queryFn: () => fetch(`/api/outages/${id}`).then(r => r.json()),
  })

  const followUpMutation = useMutation({
    mutationFn: (body) =>
      fetch(`/api/outages/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'addFollowUp', ...body }),
      }).then(r => r.json()),
    onSuccess: () => {
      setShowFollowUp(false)
      setFuForm({ channel: '', actionTaken: '', notes: '', loggedAt: new Date().toISOString().split('T')[0] })
      qc.invalidateQueries({ queryKey: ['outage', id] })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/outages/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'resolve' }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outage', id] })
      qc.invalidateQueries({ queryKey: ['outages'] })
      qc.invalidateQueries({ queryKey: ['active-outages'] })
    },
  })

  if (isLoading) return <div className="animate-pulse h-96 bg-gray-100 rounded-2xl" />
  if (!outage || outage.error) return <div className="text-red-500">Outage not found</div>

  const isActive   = outage.outageStatus === 'Active'
  const duration   = formatDuration(outage.openedAt, outage.resolvedAt)

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumb items={[{ label: 'Outages', href: '/outages' }, { label: outage.title }]} />

      {/* Header Card */}
      <div className={`rounded-2xl border p-5 space-y-4 ${isActive ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${isActive ? 'bg-red-100 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {isActive ? '🔴 ACTIVE OUTAGE' : '✓ RESOLVED OUTAGE'}
              </span>
            </div>
            <h2 className={`text-lg font-bold ${isActive ? 'text-red-900' : 'text-gray-900'}`}>{outage.title}</h2>
            <p className={`text-sm ${isActive ? 'text-red-600' : 'text-gray-500'}`}>
              Opened {fmtDate(outage.openedAt)} by {outage.openedBy?.name || outage.openedBy?.email}
              {duration && <> · Duration: <span className="font-medium">{duration}</span></>}
            </p>
            {outage.description && (
              <p className={`text-sm mt-1 ${isActive ? 'text-red-700' : 'text-gray-600'}`}>{outage.description}</p>
            )}
            {isActive && (
              <p className="text-xs text-red-400 mt-1 italic">⚠ This outage is visible on all account pages while active</p>
            )}
          </div>
          {isActive && (
            <button
              onClick={() => { if (confirm('Mark this outage as resolved? The banner will be removed from all account pages.')) resolveMutation.mutate() }}
              disabled={resolveMutation.isPending}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              ✓ Resolve Outage
            </button>
          )}
        </div>

        {!isActive && duration && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">Resolved: <span className="text-gray-700 font-medium">{fmtDate(outage.resolvedAt)}</span></span>
            <span className="text-gray-400">Total duration: <span className="text-gray-700 font-medium">{duration}</span></span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Update Timeline</h3>
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-0">

            {/* Opening entry */}
            <div className="relative flex gap-4 pb-5">
              <div className="relative z-10 w-6 h-6 rounded-full bg-red-100 border-2 border-red-300 flex-shrink-0 flex items-center justify-center">
                <span className="text-xs">🚨</span>
              </div>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-gray-700">Outage Declared</span>
                  <span className="text-xs text-gray-400">by {outage.openedBy?.name || outage.openedBy?.email}</span>
                  <span className="text-xs text-gray-400">· {fmtDate(outage.openedAt)}</span>
                </div>
                {outage.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{outage.description}</p>
                )}
              </div>
            </div>

            {/* Follow-ups */}
            {outage.followUps?.map(fu => (
              <div key={fu.id} className="relative flex gap-4 pb-5">
                <div className="relative z-10 w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-200 flex-shrink-0 flex items-center justify-center">
                  <span className="text-xs">💬</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-700">Update</span>
                    <span className="text-xs text-gray-400">by {fu.author?.name || fu.author?.email}</span>
                    <span className="text-xs text-gray-400">· {fmtDate(fu.loggedAt)}</span>
                  </div>
                  {fu.channel && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mb-1">
                      {CHANNEL_LABELS[fu.channel] || fu.channel}
                    </span>
                  )}
                  {fu.actionTaken && (
                    <p className="text-xs text-gray-500 mb-1">
                      <span className="font-medium text-gray-600">Action:</span> {fu.actionTaken}
                    </p>
                  )}
                  {fu.notes && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{fu.notes}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Resolved entry */}
            {!isActive && (
              <div className="relative flex gap-4">
                <div className="relative z-10 w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-300 flex-shrink-0 flex items-center justify-center">
                  <span className="text-xs">✓</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">Outage Resolved</span>
                    <span className="text-xs text-gray-400">· {fmtDate(outage.resolvedAt)}</span>
                    {duration && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Duration: {duration}</span>}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Add Follow-up form */}
        {isActive && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {showFollowUp ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Add Update</p>
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
                    placeholder="e.g. Contacted Foodics support, Notified clients…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={fuForm.notes}
                    onChange={e => setFuForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="Current status update…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowFollowUp(false) }}
                    className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => followUpMutation.mutate(fuForm)}
                    disabled={!fuForm.loggedAt || followUpMutation.isPending}
                    className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
                  >
                    {followUpMutation.isPending ? 'Saving…' : '+ Post Update'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowFollowUp(true)}
                className="text-sm text-indigo-500 hover:text-indigo-700 font-medium"
              >
                + Post Update
              </button>
            )}
          </div>
        )}
      </div>
      {/* Impacted Accounts */}
      {outage.linkedCases?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Impacted Accounts
            <span className="ml-2 text-xs font-normal text-gray-400">{outage.linkedCases.length} case{outage.linkedCases.length !== 1 ? 's' : ''} reported</span>
          </h3>
          <div className="divide-y divide-gray-50">
            {outage.linkedCases.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.account ? (
                      <Link href={`/accounts/${c.account.id}`} className="text-sm font-medium text-indigo-600 hover:underline truncate">
                        {c.account.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No account</span>
                    )}
                    <span className="text-gray-300">·</span>
                    <Link href={`/cases/${c.id}`} className="text-sm text-gray-600 hover:text-indigo-600 hover:underline truncate">
                      {c.title}
                    </Link>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Opened {fmtDate(c.openedAt)} by {c.openedBy?.name || c.openedBy?.email}
                  </p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
