'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { CHANNEL_LABELS, OBJECTIVE_LABELS, LOG_FORM_OBJECTIVES, calcDuration } from '@/app/(app)/engagement-logs/page'
import { STATUS_LABELS, STATUS_COLORS, OBJECTIVE_COLORS, OBJECTIVE_LABELS as CASE_OBJECTIVE_LABELS, CASE_FORM_OBJECTIVES } from '@/app/(app)/cases/page'

function HandoverField({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function HandoverSection({ title, children }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function combineDateAndTime(date, time) {
  if (!date || !time) return null
  return new Date(`${date}T${time}:00`).toISOString()
}

export default function AccountDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [showHandover, setShowHandover] = useState(
    typeof window !== 'undefined' && window.location.hash === '#handover'
  )

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => fetch(`/api/accounts/${id}`).then((r) => r.json()),
  })

  const { data: handover } = useQuery({
    queryKey: ['account-handover', id],
    queryFn: () => fetch(`/api/accounts/${id}/handover`).then((r) => r.ok ? r.json() : null),
    enabled: !!id,
  })

  const { data: activityLog = [] } = useQuery({
    queryKey: ['account-activity', id],
    queryFn: () => fetch(`/api/accounts/${id}/activity`).then((r) => r.json()),
    enabled: !!id,
  })

  const { data: surveys } = useQuery({
    queryKey: ['account-surveys', id],
    queryFn: () => fetch(`/api/accounts/${id}/surveys`).then((r) => r.json()),
    enabled: !!id,
  })

  const qc = useQueryClient()
  const [noteText, setNoteText] = useState('')
  const [brandInput, setBrandInput] = useState('')
  const brandInputRef = useRef(null)

  const { data: brands = [] } = useQuery({
    queryKey: ['account-brands', id],
    queryFn: () => fetch(`/api/accounts/${id}/brands`).then((r) => r.json()),
    enabled: !!id,
  })

  const addBrand = useMutation({
    mutationFn: (name) =>
      fetch(`/api/accounts/${id}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setBrandInput('')
      qc.invalidateQueries({ queryKey: ['account-brands', id] })
      qc.invalidateQueries({ queryKey: ['account', id] })
    },
  })

  const deleteBrand = useMutation({
    mutationFn: (brandId) =>
      fetch(`/api/accounts/${id}/brands?brandId=${brandId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-brands', id] })
      qc.invalidateQueries({ queryKey: ['account', id] })
    },
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['account-notes', id],
    queryFn: () => fetch(`/api/accounts/${id}/notes`).then((r) => r.json()),
    enabled: !!id,
  })

  const addNote = useMutation({
    mutationFn: (content) =>
      fetch(`/api/accounts/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setNoteText('')
      qc.invalidateQueries({ queryKey: ['account-notes', id] })
    },
  })

  const deleteNote = useMutation({
    mutationFn: (noteId) =>
      fetch(`/api/accounts/${id}/notes?noteId=${noteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-notes', id] }),
  })

  // ── Engagement Logs ──
  const { data: engagements = [] } = useQuery({
    queryKey: ['account-engagements', id],
    queryFn: () => fetch(`/api/accounts/${id}/engagement-logs`).then((r) => r.json()),
    enabled: !!id,
  })

  // ── Cases ──
  const { data: cases = [] } = useQuery({
    queryKey: ['account-cases', id],
    queryFn: () => fetch(`/api/accounts/${id}/cases`).then((r) => r.json()),
    enabled: !!id,
  })

  const { data: activeOutages = [] } = useQuery({
    queryKey: ['active-outages'],
    queryFn: () => fetch('/api/outages/active').then(r => r.ok ? r.json() : []).catch(() => []),
    staleTime: 30 * 1000,
  })

  const [caseModal, setCaseModal] = useState(false)
  const [caseForm, setCaseForm]   = useState({ title: '', channel: '', objective: '', description: '', assignedToId: '', openedAt: new Date().toISOString().split('T')[0], outageId: '' })

  const createCase = useMutation({
    mutationFn: (data) =>
      fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, accountId: id }),
      }).then(r => r.json()),
    onSuccess: () => {
      setCaseModal(false)
      setCaseForm({ title: '', channel: '', objective: '', description: '', assignedToId: '', openedAt: new Date().toISOString().split('T')[0], outageId: '' })
      qc.invalidateQueries({ queryKey: ['account-cases', id] })
    },
  })

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetch('/api/users/staff').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const [engForm, setEngForm] = useState({ channel: '', objective: '', notes: '', loggedAt: new Date().toISOString().slice(0, 10), startTime: '', endTime: '' })
  const [showEngForm, setShowEngForm] = useState(false)

  const addEngagement = useMutation({
    mutationFn: (data) => fetch('/api/engagement-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, accountId: id }),
    }).then((r) => r.json()),
    onSuccess: () => {
      setEngForm({ channel: '', objective: '', notes: '', loggedAt: new Date().toISOString().slice(0, 10), startTime: '', endTime: '' })
      setShowEngForm(false)
      qc.invalidateQueries({ queryKey: ['account-engagements', id] })
    },
  })

  const deleteEngagement = useMutation({
    mutationFn: (eid) => fetch(`/api/engagement-logs/${eid}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-engagements', id] }),
  })

  function handleEngSave() {
    if (!engForm.channel || !engForm.objective || !engForm.loggedAt) return
    addEngagement.mutate({
      ...engForm,
      startTime: engForm.startTime ? combineDateAndTime(engForm.loggedAt, engForm.startTime) : null,
      endTime:   engForm.endTime   ? combineDateAndTime(engForm.loggedAt, engForm.endTime)   : null,
    })
  }

  const CHANNEL_COLOR = {
    Whatsapp: 'bg-emerald-50 text-emerald-700', Call: 'bg-blue-50 text-blue-700',
    VirtualMeeting: 'bg-violet-50 text-violet-700', PhysicalMeeting: 'bg-amber-50 text-amber-700',
    Email: 'bg-sky-50 text-sky-700', Other: 'bg-gray-50 text-gray-600',
  }
  const OBJECTIVE_COLOR = {
    Inquiry: 'bg-blue-50 text-blue-700', BugReport: 'bg-red-50 text-red-700',
    TrainingRequest: 'bg-amber-50 text-amber-700', NewRequirement: 'bg-indigo-50 text-indigo-700',
    TechnicalRequest: 'bg-violet-50 text-violet-700', GlobalOutage: 'bg-red-100 text-red-800',
  }

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
  if (!account || account.error) return <div className="text-red-500">Account not found</div>

  // ── Pipeline Origin helpers ──
  const PIPELINE_CHANNEL_LABELS = {
    Foodics: 'Foodics', EmployeeReferral: 'Employee Referral', CustomerReferral: 'Customer Referral',
    PartnerReferral: 'Partner Referral', Website: 'Website', AmbassadorReferral: 'Ambassador Referral',
    DirectSales: 'Direct Sales', Sonic: 'Sonic',
  }
  function pipelineDays(lead) {
    if (!lead?.convertedAt || !lead?.createdAt) return null
    return Math.round((new Date(lead.convertedAt) - new Date(lead.createdAt)) / 86400000)
  }

  // ── Deals columns ──
  const dealCols = [
    { key: 'id',                  label: '#',             render: (r) => <span className="text-gray-400 text-xs">#{r.id}</span> },
    { key: 'createdAt',           label: 'Date',          render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'accountName',         label: 'Account Name',  render: (r) => <span className="font-medium">{r.accountName}</span> },
    { key: 'package',             label: 'Package',       render: (r) => r.package || '—' },
    { key: 'contractValue',       label: 'Value (excl.)', render: (r) => r.contractValue != null ? `USD ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—' },
    { key: 'contractValueInclVAT',label: 'Value (incl.)', render: (r) => r.contractValueInclVAT != null ? `USD ${Number(r.contractValueInclVAT).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—' },
  ]

  const contractCols = [
    { key: 'type',           label: 'Type',          render: (r) => <Badge value={r.type} /> },
    { key: 'startDate',      label: 'Contract Date',  render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'activationDate', label: 'Activation',     render: (r) => r.activationDate ? new Date(r.activationDate).toLocaleDateString() : '—' },
    { key: 'endDate',        label: 'End',            render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'contractValue', label: 'Value', render: (r) => `USD ${Number(r.contractValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { key: 'mrr', label: 'MRR', render: (r) => `USD ${(r.mrr || 0).toFixed(2)}` },
    { key: 'contractStatus', label: 'Status', render: (r) => <Badge value={r.contractStatus} /> },
    { key: 'churnFlag', label: 'Churn', render: (r) => <Badge value={r.churnFlag} /> },
    { key: 'cancellationDate', label: 'Cancelled', render: (r) => r.cancellationDate ? new Date(r.cancellationDate).toLocaleDateString() : '—' },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Accounts', href: '/accounts' }, { label: account.name }]} />
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-gray-900">{account.name}</h2>
        <Badge value={account.status} />
        <span className="text-sm text-gray-400">#{account.id} · {account.countryName || account.countryCode} · {account.leadSource?.replace(/([A-Z])/g, ' $1').trim()}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {account.status === 'Active'
          ? <KPICard label="Total MRR" value={account.totalMRR} format="currency" />
          : <KPICard label="Last Active MRR" value={account.lastMRR} format="currency"
              subLabel="When last active" accent="#f97316" />
        }
        <KPICard label="Contracts" value={account.contractCount} format="integer" />
        <KPICard label="Branches" value={account.numberOfBranches} format="integer" />
        <KPICard label="Brands" value={account.brands} format="integer" />
      </div>

      {/* Brand Names */}
      {(brands.length > 0 || account.brands > 1) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Brand Names</h3>
            <span className="text-xs text-gray-400">{brands.length} brand{brands.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {brands.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full border border-indigo-100 group"
              >
                {b.name}
                <button
                  onClick={() => deleteBrand.mutate(b.id)}
                  className="opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-red-500 transition-all leading-none ml-0.5"
                  title="Remove brand"
                >
                  ×
                </button>
              </span>
            ))}
            {/* Inline add */}
            <div className="flex items-center gap-1">
              <input
                ref={brandInputRef}
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && brandInput.trim()) {
                    addBrand.mutate(brandInput.trim())
                  }
                  if (e.key === 'Escape') setBrandInput('')
                }}
                placeholder="Add brand…"
                className="text-sm border border-gray-200 rounded-full px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-28 focus:w-40 transition-all"
              />
              {brandInput.trim() && (
                <button
                  onClick={() => addBrand.mutate(brandInput.trim())}
                  disabled={addBrand.isPending}
                  className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Origin */}
      {account.lead ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-700">🎯 Pipeline Origin</h3>
            <a href={`/pipeline`} className="text-xs text-indigo-500 hover:underline">View in Pipeline →</a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Channel</p>
              <p className="font-medium text-gray-700">{PIPELINE_CHANNEL_LABELS[account.lead.channel] || account.lead.channel}</p>
            </div>
            {account.lead.estimatedValue && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Est. Value</p>
                <p className="font-medium text-gray-700">{Number(account.lead.estimatedValue).toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
              </div>
            )}
            {pipelineDays(account.lead) !== null && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Days to Close</p>
                <p className="font-medium text-gray-700">{pipelineDays(account.lead)} days</p>
              </div>
            )}
            {account.lead.convertedAt && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Converted</p>
                <p className="font-medium text-gray-700">{new Date(account.lead.convertedAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-400">No pipeline history linked to this account.</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Contracts</h3>
        <DataTable columns={contractCols} data={account.contracts || []} />
      </div>

      {/* Deals */}
      {account.deals && account.deals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Deals</h3>
          <DataTable columns={dealCols} data={account.deals} />
        </div>
      )}

      {/* Onboarding */}
      {account.onboarding && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-indigo-700">🚀 Onboarding</h3>
            <a href={`/onboarding/${account.onboarding.id}`} className="text-xs text-indigo-500 hover:underline">
              View tracker →
            </a>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Current Phase</p>
              <p className="font-medium text-gray-700">
                {account.onboarding.phase.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Phase Progress</p>
              <p className="font-medium text-gray-700">
                {account.onboarding.currentPhaseCompleted}/{account.onboarding.currentPhaseTasks} tasks
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Overall</p>
              <p className="font-medium text-gray-700">
                {account.onboarding.completedTasks}/{account.onboarding.totalTasks} tasks
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Started</p>
              <p className="font-medium text-gray-700">
                {new Date(account.onboarding.startDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Survey Scores */}
      {surveys && (surveys.csat?.length > 0 || surveys.nps?.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Survey History</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CSAT */}
            {surveys.csat?.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">CSAT</span>
                  <span className="text-xs text-gray-400">avg {(surveys.csat.filter(r => r.score != null).reduce((s, r) => s + r.score, 0) / (surveys.csat.filter(r => r.score != null).length || 1)).toFixed(1)} / 5</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {surveys.csat.slice(0, 8).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        r.score >= 4 ? 'bg-emerald-50 text-emerald-700' : r.score >= 3 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {r.score ?? '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 truncate">
                          {r.fromPhase?.replace(/([A-Z])/g, ' $1').trim()}
                          {r.toPhase ? <span className="text-gray-400"> → {r.toPhase.replace(/([A-Z])/g, ' $1').trim()}</span> : null}
                        </p>
                        {r.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{r.notes}</p>}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{new Date(r.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NPS */}
            {surveys.nps?.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">NPS</span>
                  <span className="text-xs text-gray-400">avg {(surveys.nps.filter(r => r.score != null).reduce((s, r) => s + r.score, 0) / (surveys.nps.filter(r => r.score != null).length || 1)).toFixed(1)} / 10</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {surveys.nps.slice(0, 8).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        r.score >= 9 ? 'bg-emerald-50 text-emerald-700' : r.score >= 7 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {r.score ?? '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600">{r.quarter || r.phase?.replace(/([A-Z])/g, ' $1').trim() || '—'}</p>
                        {r.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{r.notes}</p>}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{new Date(r.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Notes */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteText.trim()) {
                  addNote.mutate(noteText)
                }
              }}
              placeholder="Add a note… (Cmd+Enter to save)"
              rows={2}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
            <button
              onClick={() => noteText.trim() && addNote.mutate(noteText)}
              disabled={!noteText.trim() || addNote.isPending}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors self-end"
            >
              Save
            </button>
          </div>
          {notes.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
              {notes.map((note) => (
                <div key={note.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {note.authorName && <span>{note.authorName} · </span>}
                      {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote.mutate(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs mt-0.5 flex-shrink-0"
                    title="Delete note"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Cases ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Open Cases
            {cases.filter(c => c.status === 'Open' || c.status === 'Escalated').length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                {cases.filter(c => c.status === 'Open' || c.status === 'Escalated').length}
              </span>
            )}
          </h3>
          <button
            onClick={() => setCaseModal(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            + Open Case
          </button>
        </div>

        {/* Active outage notice */}
        {activeOutages.length > 0 && (
          <div className="mb-3 space-y-1">
            {activeOutages.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-red-700">🔴 OUTAGE</span>
                  <span className="text-xs text-red-700 font-medium truncate">{o.title}</span>
                  <span className="text-xs text-red-400">· affecting all accounts</span>
                </div>
                <Link href={`/outages/${o.id}`} className="text-xs text-red-600 font-semibold hover:underline flex-shrink-0">
                  View / Update →
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Cases list */}
        {cases.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl py-8 text-center text-gray-400 text-xs">
            No cases yet — open a case to track issues and follow-ups
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {cases.map(c => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
                <span className="text-sm text-gray-700 font-medium flex-1 truncate">{c.title}</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${OBJECTIVE_COLORS[c.objective] || 'bg-gray-50 text-gray-500'}`}>
                  {CASE_OBJECTIVE_LABELS[c.objective] || c.objective}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(c.openedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Case creation modal */}
      {caseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Open New Case</h3>
              <button onClick={() => setCaseModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={caseForm.title}
                onChange={e => setCaseForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Short summary of the issue…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Channel <span className="text-red-500">*</span></label>
                <select
                  value={caseForm.channel}
                  onChange={e => setCaseForm(f => ({ ...f, channel: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">Select…</option>
                  {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Objective <span className="text-red-500">*</span></label>
                <select
                  value={caseForm.objective}
                  onChange={e => setCaseForm(f => ({ ...f, objective: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">Select…</option>
                  {Object.entries(CASE_FORM_OBJECTIVES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                value={caseForm.description}
                onChange={e => setCaseForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Detailed notes…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
                <select
                  value={caseForm.assignedToId}
                  onChange={e => setCaseForm(f => ({ ...f, assignedToId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">— Unassigned —</option>
                  {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Opened Date</label>
                <input
                  type="date"
                  value={caseForm.openedAt}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setCaseForm(f => ({ ...f, openedAt: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
            {activeOutages.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Linked Outage
                  <span className="ml-1 text-xs text-red-500 font-medium">● Active</span>
                </label>
                <select
                  value={caseForm.outageId}
                  onChange={e => setCaseForm(f => ({ ...f, outageId: e.target.value }))}
                  className="w-full border border-orange-200 bg-orange-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">— Not related to an outage —</option>
                  {activeOutages.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCaseModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createCase.mutate(caseForm)}
                disabled={!caseForm.title || !caseForm.channel || !caseForm.objective || createCase.isPending}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
              >
                {createCase.isPending ? 'Opening…' : 'Open Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engagement Logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Engagement History</h3>
          <div className="flex items-center gap-2">
            {engagements.length > 0 && (
              <span className="text-xs text-gray-400">{engagements.length} interaction{engagements.length !== 1 ? 's' : ''}</span>
            )}
            <button
              onClick={() => setShowEngForm((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#5061F6] hover:bg-[#3b4cc4] rounded-lg transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
              Log Interaction
            </button>
          </div>
        </div>

        {/* Quick-add form */}
        {showEngForm && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Channel *</label>
                <select
                  value={engForm.channel}
                  onChange={(e) => setEngForm((f) => ({ ...f, channel: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30"
                >
                  <option value="">Select…</option>
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Objective *</label>
                <select
                  value={engForm.objective}
                  onChange={(e) => setEngForm((f) => ({ ...f, objective: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30"
                >
                  <option value="">Select…</option>
                  {Object.entries(LOG_FORM_OBJECTIVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date *</label>
                <input
                  type="date"
                  value={engForm.loggedAt}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setEngForm((f) => ({ ...f, loggedAt: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Time</label>
                <input
                  type="time"
                  value={engForm.startTime}
                  onChange={(e) => setEngForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">End Time</label>
                <input
                  type="time"
                  value={engForm.endTime}
                  onChange={(e) => setEngForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30"
                />
              </div>
            </div>
            {calcDuration(
              engForm.loggedAt && engForm.startTime ? combineDateAndTime(engForm.loggedAt, engForm.startTime) : null,
              engForm.loggedAt && engForm.endTime   ? combineDateAndTime(engForm.loggedAt, engForm.endTime)   : null,
            ) && (
              <p className="text-xs text-indigo-600">
                ⏱ Duration: {calcDuration(
                  combineDateAndTime(engForm.loggedAt, engForm.startTime),
                  combineDateAndTime(engForm.loggedAt, engForm.endTime),
                )}
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
              <input
                type="text"
                value={engForm.notes}
                onChange={(e) => setEngForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Brief summary…"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowEngForm(false); setEngForm({ channel: '', objective: '', notes: '', loggedAt: new Date().toISOString().slice(0, 10), startTime: '', endTime: '' }) }}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >Cancel</button>
              <button
                onClick={handleEngSave}
                disabled={!engForm.channel || !engForm.objective || !engForm.loggedAt || addEngagement.isPending}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#5061F6] hover:bg-[#3b4cc4] disabled:opacity-40 rounded-lg transition-colors"
              >
                {addEngagement.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {engagements.length === 0 && !showEngForm ? (
          <div className="border border-dashed border-gray-200 rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-gray-400">No interactions logged yet for this account.</p>
          </div>
        ) : engagements.length > 0 ? (
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
            {engagements.map((eng) => (
              <div key={eng.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group">
                <div className="flex-shrink-0 mt-0.5 space-y-1">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CHANNEL_COLOR[eng.channel] || 'bg-gray-50 text-gray-600'}`}>
                    {CHANNEL_LABELS[eng.channel] || eng.channel}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${OBJECTIVE_COLOR[eng.objective] || 'bg-gray-50 text-gray-600'}`}>
                      {OBJECTIVE_LABELS[eng.objective] || eng.objective}
                    </span>
                  </div>
                  {eng.notes && <p className="text-sm text-gray-700 mt-1 leading-snug">{eng.notes}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {eng.loggedBy?.name || eng.loggedBy?.email || 'Unknown'} ·{' '}
                    {new Date(eng.loggedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => { if (confirm('Delete this interaction?')) deleteEngagement.mutate(eng.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs mt-0.5 flex-shrink-0"
                  title="Delete"
                >✕</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Activity History */}
      {activityLog.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Activity History</h3>
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {activityLog.map((log) => {
              const ACTION_LABELS = {
                stage_changed: 'Lead stage changed',
                closed_won:    'Deal closed — won',
                created:       'Deal created',
                phase_advanced:'Onboarding phase advanced',
                phase_changed: 'Onboarding phase changed',
                status_changed:'Invoice status changed',
              }
              const label = ACTION_LABELS[log.action] || log.action
              const meta  = log.meta || {}
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="mt-0.5 w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0 mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium">{label}</p>
                    {(meta.from || meta.to) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {meta.from && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{meta.from}</span>}
                        {meta.from && meta.to && <span className="mx-1 text-gray-400">→</span>}
                        {meta.to && <span className="bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600">{meta.to}</span>}
                      </p>
                    )}
                    {meta.lostReason && <p className="text-xs text-gray-500 mt-0.5">Reason: {meta.lostReason}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString('en-GB')}</p>
                    {log.actorName && <p className="text-xs text-gray-400">{log.actorName}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Handover Document */}
      {handover && !handover.error && (
        <div id="handover" className="border border-indigo-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHandover((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-indigo-700">Internal Handover Document</span>
              <span className="text-xs text-indigo-400">· created {new Date(handover.createdAt).toLocaleDateString()}</span>
            </div>
            <svg className={`w-4 h-4 text-indigo-500 transition-transform ${showHandover ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHandover && (
            <div className="p-5 bg-white space-y-4">

              <HandoverSection title="1. Deal Summary">
                <HandoverField label="Client Name"        value={handover.clientName} />
                <HandoverField label="Contract Start"     value={handover.contractStart ? new Date(handover.contractStart).toLocaleDateString() : null} />
                <HandoverField label="Contract Duration"  value={handover.contractDuration} />
                <HandoverField label="Commercial Model"   value={handover.commercialModel} />
              </HandoverSection>

              <HandoverSection title="2. Key Contacts">
                <HandoverField label="Client POC"          value={handover.clientPoc} />
                <HandoverField label="POC Role"            value={handover.clientPocRole} />
                <HandoverField label="Client Email"        value={handover.clientEmail} />
                <HandoverField label="Client Phone"        value={handover.clientPhone} />
                <HandoverField label="Escalation Contact"  value={handover.escalationContact} />
                <HandoverField label="Acquisition Owner"   value={handover.acquisitionOwner} />
                <HandoverField label="Assigned CS Manager" value={handover.assignedCsManager} />
              </HandoverSection>

              <HandoverSection title="3. Objectives & Success Criteria">
                <div className="sm:col-span-2"><HandoverField label="Primary Objectives"    value={handover.primaryObjectives} /></div>
                <div className="sm:col-span-2"><HandoverField label="Success Metrics"       value={handover.successMetrics} /></div>
                <HandoverField label="Short-Term Priorities" value={handover.shortTermPriorities} />
                <HandoverField label="Long-Term Priorities"  value={handover.longTermPriorities} />
              </HandoverSection>

              <HandoverSection title="4. Client Operations Snapshot">
                <div className="sm:col-span-2"><HandoverField label="How They Operate"           value={handover.howTheyOperate} /></div>
                <div className="sm:col-span-2"><HandoverField label="Order / Workflow Summary"    value={handover.orderWorkflowSummary} /></div>
                <div className="sm:col-span-2"><HandoverField label="Locations & Operating Hours" value={handover.locationsOperatingHours} /></div>
              </HandoverSection>

              <HandoverSection title="5. Pain Points & Needs">
                <HandoverField label="Key Needs"      value={handover.keyNeeds} />
                <HandoverField label="Top Pain Points" value={handover.topPainPoints} />
              </HandoverSection>

              <HandoverSection title="6. Existing Systems">
                <HandoverField label="Current Systems Used"   value={handover.currentSystemsUsed} />
                <HandoverField label="Required Integrations"  value={handover.requiredIntegrations} />
              </HandoverSection>

              <HandoverSection title="7. Scope & Critical Notes">
                <HandoverField label="In-Scope"                 value={handover.inScope} />
                <HandoverField label="Out-of-Scope"             value={handover.outOfScope} />
                <HandoverField label="Dependencies from Client" value={handover.dependenciesFromClient} />
                <div className="sm:col-span-2"><HandoverField label="Highlights / Critical Notes" value={handover.highlights} /></div>
              </HandoverSection>

            </div>
          )}
        </div>
      )}
    </div>
  )
}
