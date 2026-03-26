'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { CHANNEL_LABELS } from '../cases/page'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(openedAt, resolvedAt) {
  if (!resolvedAt) return 'Ongoing'
  const ms  = new Date(resolvedAt) - new Date(openedAt)
  const hrs = ms / (1000 * 60 * 60)
  if (hrs < 1) return `${Math.round(hrs * 60)}m`
  if (hrs < 24) return `${Math.round(hrs)}h`
  return `${Math.floor(hrs / 24)}d ${Math.round(hrs % 24)}h`
}

function DeclareModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', channel: '', description: '' })
  const valid = form.title && form.channel

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Declare Global Outage</h3>
            <p className="text-xs text-gray-400 mt-0.5">This will be visible on all account pages while active</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Outage Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Foodics API Degraded"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Channel <span className="text-red-500">*</span></label>
          <select
            value={form.channel}
            onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          >
            <option value="">Select…</option>
            {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="What is happening? What systems are affected?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
          >
            🚨 Declare Outage
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OutagesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)

  const { data: outages = [], isLoading } = useQuery({
    queryKey: ['outages'],
    queryFn: () => fetch('/api/outages').then(r => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (body) =>
      fetch('/api/outages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => r.json()),
    onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['outages'] }); qc.invalidateQueries({ queryKey: ['active-outages'] }) },
  })

  const resolveMutation = useMutation({
    mutationFn: (id) =>
      fetch(`/api/outages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resolve' }) })
        .then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['outages'] }); qc.invalidateQueries({ queryKey: ['active-outages'] }) },
  })

  const active = outages.filter(o => o.outageStatus === 'Active')
  const past   = outages.filter(o => o.outageStatus === 'Resolved')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Global Outages</h2>
          <p className="text-sm text-gray-400 mt-0.5">Active outages are shown on all account pages</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
        >
          🚨 Declare Outage
        </button>
      </div>

      {isLoading && <div className="animate-pulse h-48 bg-gray-100 rounded-2xl" />}

      {/* Active Outages */}
      {!isLoading && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Active Outages ({active.length})
          </h3>
          {active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400 text-sm">
              No active outages 🎉
            </div>
          ) : (
            active.map(o => (
              <div key={o.id} className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                        🔴 ACTIVE
                      </span>
                      <h4 className="text-base font-bold text-red-800">{o.title}</h4>
                    </div>
                    <p className="text-xs text-red-500">
                      Opened {fmtDate(o.openedAt)} by {o.openedBy?.name || o.openedBy?.email}
                      {' · '}Duration: {formatDuration(o.openedAt, o.resolvedAt)}
                    </p>
                    {o.description && <p className="text-sm text-red-700 mt-1">{o.description}</p>}
                    <p className="text-xs text-red-400 mt-1">
                      {o.followUps?.length || 0} follow-up{o.followUps?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { if (confirm('Resolve this outage? This will remove the banner from all account pages.')) resolveMutation.mutate(o.id) }}
                      disabled={resolveMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >
                      ✓ Resolve Outage
                    </button>
                    <Link
                      href={`/outages/${o.id}`}
                      className="px-3 py-1.5 rounded-lg text-sm border border-red-200 text-red-700 hover:bg-red-100 font-medium"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* Past Outages */}
      {!isLoading && past.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Past Outages ({past.length})</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Title', 'Opened', 'Resolved', 'Duration', 'Follow-ups', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {past.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{o.title}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(o.openedAt)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(o.resolvedAt)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDuration(o.openedAt, o.resolvedAt)}</td>
                      <td className="px-4 py-3 text-gray-500">{o.followUps?.length || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/outages/${o.id}`} className="text-xs text-indigo-500 hover:underline">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {modal && (
        <DeclareModal
          onClose={() => setModal(false)}
          onSave={(form) => createMutation.mutate(form)}
        />
      )}
    </div>
  )
}
