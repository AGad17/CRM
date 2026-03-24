'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { calcDealSummary } from '@/lib/invoicingCalc'

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'Lead',       label: 'Lead',        color: 'bg-slate-100 text-slate-700',     dot: 'bg-slate-400'    },
  { key: 'Qualified',  label: 'Qualified',   color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'     },
  { key: 'ClosedWon',  label: 'Closed Won',  color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500'  },
  { key: 'ClosedLost', label: 'Closed Lost', color: 'bg-red-100 text-red-600',         dot: 'bg-red-400'      },
]

const CHANNEL_COLORS = {
  Foodics:           'bg-purple-100 text-purple-700',
  EmployeeReferral:  'bg-blue-100 text-blue-700',
  CustomerReferral:  'bg-teal-100 text-teal-700',
  PartnerReferral:   'bg-indigo-100 text-indigo-700',
  Website:           'bg-pink-100 text-pink-700',
  AmbassadorReferral:'bg-orange-100 text-orange-700',
  DirectSales:       'bg-green-100 text-green-700',
  Sonic:             'bg-violet-100 text-violet-700',
}

const CHANNEL_LABELS = {
  Foodics:           'Foodics',
  EmployeeReferral:  'Employee Referral',
  CustomerReferral:  'Customer Referral',
  PartnerReferral:   'Partner Referral',
  Website:           'Website',
  AmbassadorReferral:'Ambassador',
  DirectSales:       'Direct Sales',
  Sonic:             'Sonic',
}

const COUNTRIES = ['Egypt', 'KSA', 'UAE', 'Bahrain', 'Jordan']
const PACKAGES  = ['Essential', 'Operations', 'Enterprise']

const COUNTRY_CURRENCY = { Egypt: 'EGP', KSA: 'SAR', UAE: 'AED', Bahrain: 'BHD', Jordan: 'JOD' }

const OPP_TYPES = [
  { key: 'New',       label: 'New',       desc: 'Brand new account — no prior relationship', icon: '✨' },
  { key: 'Expansion', label: 'Expansion', desc: 'Existing account adding more branches or modules', icon: '📈' },
  { key: 'Renewal',   label: 'Renewal',   desc: 'Existing account renewing their current contract', icon: '🔄' },
]

const OPP_COLORS = {
  New:       'bg-indigo-100 text-indigo-700',
  Expansion: 'bg-emerald-100 text-emerald-700',
  Renewal:   'bg-amber-100 text-amber-700',
}

const EMPTY_FORM = {
  companyName: '', contactName: '', contactEmail: '', contactPhone: '',
  channel: '', countryCode: '', estimatedValue: '', packageInterest: '',
  branches: '', opportunityDate: new Date().toISOString().slice(0, 10),
  expectedCloseDate: '', notes: '', ownerId: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stageInfo(key) {
  return STAGES.find((s) => s.key === key) || STAGES[0]
}

function fmtValue(v, countryCode) {
  if (!v) return null
  const cur = COUNTRY_CURRENCY[countryCode] || ''
  return `${cur} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function daysAgo(date) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return '1d ago'
  return `${d}d ago`
}

function leadRiskStatus(lead) {
  if (!['Lead', 'Qualified'].includes(lead.stage)) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (lead.expectedCloseDate && new Date(lead.expectedCloseDate) < today) return 'overdue'
  const daysSinceUpdate = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / 86400000)
  if (daysSinceUpdate >= 7) return 'stale'
  return null
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StageBadge({ stage }) {
  const s = stageInfo(stage)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function ChannelBadge({ channel }) {
  const cls = CHANNEL_COLORS[channel] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {CHANNEL_LABELS[channel] || channel}
    </span>
  )
}

// ─── Lead Form ───────────────────────────────────────────────────────────────

function LeadForm({ form, setForm, errors, agents, pricing }) {
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const cls = (k) => `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[k] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`

  // Auto-calculate estimated value from branches + package + country + channel
  const estSummary = useMemo(() => {
    if (!pricing || !form.countryCode || !form.channel || !form.packageInterest || !form.branches) return null
    const country = (pricing.countries || []).find((c) => c.code === form.countryCode)
    if (!country) return null
    try {
      return calcDealSummary({
        normalBranches:          Number(form.branches) || 0,
        centralKitchens:         0, warehouses: 0,
        hasAccounting:           false, extraAccountingBranches: 0,
        hasButchering:           false, aiAgentUsers: 0,
        countryCode:             form.countryCode,
        salesChannel:            form.channel,
        package:                 form.packageInterest,
        paymentType:             'Annual', contractYears: 1,
        vatRate:                 Number(country.vatRate || 0),
        discount:                0, lineDiscounts: {},
        inventoryPricing:        pricing.inventoryPricing || [],
        addOnPricing:            pricing.addOnPricing || [],
      })
    } catch { return null }
  }, [pricing, form.countryCode, form.channel, form.packageInterest, form.branches])

  // Sync calculated value to estimatedValue form field
  useEffect(() => {
    if (estSummary) {
      setForm((p) => ({ ...p, estimatedValue: String(Math.round(estSummary.effectiveAnnual)) }))
    }
  }, [estSummary, setForm])

  const currency = COUNTRY_CURRENCY[form.countryCode] || ''
  const canCalc  = form.countryCode && form.channel && form.packageInterest && form.branches

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company Name *</label>
          <input className={cls('companyName')} value={form.companyName} onChange={set('companyName')} placeholder="e.g. Al Baik Restaurant Group" />
          {errors.companyName && <p className="text-xs text-red-500 mt-0.5">{errors.companyName}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Name</label>
          <input className={cls('contactName')} value={form.contactName} onChange={set('contactName')} placeholder="Full name" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Phone</label>
          <input className={cls('contactPhone')} value={form.contactPhone} onChange={set('contactPhone')} placeholder="+20 100 000 0000" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Email</label>
          <input className={cls('contactEmail')} type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="contact@company.com" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Channel *</label>
          <select className={cls('channel')} value={form.channel} onChange={set('channel')}>
            <option value="">Select channel…</option>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {errors.channel && <p className="text-xs text-red-500 mt-0.5">{errors.channel}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Country</label>
          <select className={cls('countryCode')} value={form.countryCode} onChange={set('countryCode')}>
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Package Interest</label>
          <select className={cls('packageInterest')} value={form.packageInterest} onChange={set('packageInterest')}>
            <option value="">Any</option>
            {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Est. Branches</label>
          <input className={cls('branches')} type="number" min="0" value={form.branches} onChange={set('branches')} placeholder="0" />
        </div>
        {/* Deal value: auto-calculated card or manual fallback */}
        <div className="col-span-2">
          {estSummary ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Auto-calculated Deal Value</p>
                <p className="text-base font-bold text-indigo-700">
                  {currency} {Math.round(estSummary.effectiveAnnual).toLocaleString('en-US')}
                  <span className="text-xs font-normal text-indigo-400 ml-1">/ year excl. VAT</span>
                </p>
                <p className="text-xs text-indigo-400 mt-0.5">
                  MRR {currency} {Math.round(estSummary.totalMRR).toLocaleString('en-US')} · {form.branches} branch{Number(form.branches) !== 1 ? 'es' : ''} · {form.packageInterest}
                </p>
              </div>
              <span className="text-indigo-200 text-3xl font-light">≈</span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Est. Value {currency ? `(${currency})` : ''}
                {!canCalc && <span className="text-gray-300 font-normal ml-1 normal-case">· set country, channel, package & branches to auto-calculate</span>}
              </label>
              <input className={cls('estimatedValue')} type="number" min="0" value={form.estimatedValue} onChange={set('estimatedValue')} placeholder="0" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Opportunity Date *</label>
          <input className={cls('opportunityDate')} type="date" max={new Date().toISOString().slice(0, 10)} value={form.opportunityDate} onChange={set('opportunityDate')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected Close Date</label>
          <input className={cls('expectedCloseDate')} type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Owner *</label>
          <select className={cls('ownerId')} value={form.ownerId} onChange={set('ownerId')}>
            <option value="">Assign to…</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {errors.ownerId && <p className="text-xs text-red-500 mt-0.5">{errors.ownerId}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
          <textarea className={cls('notes')} rows={3} value={form.notes} onChange={set('notes')} placeholder="Optional notes…" />
        </div>
      </div>
    </div>
  )
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────

function LeadCard({ lead, onStageAction, onEdit, isAdmin }) {
  const val = fmtValue(lead.estimatedValue, lead.countryCode)
  const riskStatus = leadRiskStatus(lead)
  const daysSinceUpdate = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / 86400000)
  const borderCls = riskStatus === 'overdue' ? 'border-l-4 border-l-red-400'
                  : riskStatus === 'stale'   ? 'border-l-4 border-l-amber-400' : ''
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow space-y-2.5 ${borderCls}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.companyName}</p>
          {lead.contactName && (
            <p className="text-xs text-gray-500 truncate">{lead.contactName}{lead.contactEmail ? ` · ${lead.contactEmail}` : ''}</p>
          )}
        </div>
        {riskStatus === 'overdue' && <span className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">⚠ Overdue</span>}
        {riskStatus === 'stale'   && <span className="flex-shrink-0 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">💤 {daysSinceUpdate}d stale</span>}
        <button onClick={() => onEdit(lead)} className="text-gray-300 hover:text-gray-600 flex-shrink-0 p-0.5 rounded transition-colors" title="Edit lead">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {lead.opportunityType && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${OPP_COLORS[lead.opportunityType] || 'bg-gray-100 text-gray-600'}`}>
            {lead.opportunityType}
          </span>
        )}
        <ChannelBadge channel={lead.channel} />
        {lead.countryCode && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{lead.countryCode}</span>
        )}
        {lead.packageInterest && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">{lead.packageInterest}</span>
        )}
      </div>

      {/* Value + meta */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="font-semibold text-gray-700">{val || '—'}</span>
        <div className="flex items-center gap-2">
          <span>{daysAgo(lead.opportunityDate)}</span>
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials(lead.owner?.name)}
          </span>
        </div>
      </div>

      {/* Account link */}
      {lead.account ? (
        <a href={`/accounts/${lead.account.id}`}
           onClick={(e) => e.stopPropagation()}
           className="text-xs text-indigo-600 hover:underline truncate block">
          🏢 {lead.account.name}
        </a>
      ) : (lead.stage === 'ClosedWon') ? (
        <span className="text-xs text-gray-300 italic">No account linked</span>
      ) : null}

      {/* Actions */}
      <CardActions lead={lead} onStageAction={onStageAction} isAdmin={isAdmin} />
    </div>
  )
}

function CardActions({ lead, onStageAction, isAdmin }) {
  const { stage } = lead
  if (stage === 'Lead') return (
    <div className="flex gap-1.5 pt-1 border-t border-gray-100">
      <button onClick={() => onStageAction(lead, 'Qualified')} className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-2 py-1.5 font-medium transition-colors">Qualify →</button>
      <button onClick={() => onStageAction(lead, 'ClosedLost')} className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-2 py-1.5 font-medium transition-colors">✗ Lost</button>
    </div>
  )
  if (stage === 'Qualified') return (
    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
      <button onClick={() => onStageAction(lead, 'ClosedWon')} className="flex-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg px-2 py-1.5 font-medium transition-colors">Close Won ✓</button>
      <button onClick={() => onStageAction(lead, 'ClosedLost')} className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-2 py-1.5 font-medium transition-colors">✗ Lost</button>
      <button onClick={() => onStageAction(lead, 'Lead')} className="w-full text-xs text-gray-400 hover:text-gray-600 rounded-lg px-2 py-1 transition-colors text-center">← Move back to Lead</button>
    </div>
  )
  // ClosedWon & ClosedLost: terminal in pipeline — lifecycle tracked in Operations
  return null
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const router   = useRouter()
  const qc       = useQueryClient()
  const { data: session } = useSession()
  const isAdmin  = session?.user?.role === 'CCO_ADMIN'

  // Top-level tab: 'leads' | 'expired'
  const [tab, setTab] = useState('leads')

  // View toggle (leads tab)
  const [view, setView] = useState('kanban')

  // Filters
  const [search,    setSearch]    = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')

  // Modals
  // null | 'create' | { edit: lead } | { confirmLoss: lead } | { confirmChurn: lead } | { closedWonBlocked: lead, missing: string[] } | 'migrate'
  const [modal, setModal] = useState(null)
  const [lostReason, setLostReason] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [migrateResult, setMigrateResult] = useState(null)
  // New Opportunity flow
  const [oppType, setOppType] = useState(null)           // null | 'New' | 'Expansion' | 'Renewal'
  const [accountSearch, setAccountSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState(null)

  // ── Data ──
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: () => fetch('/api/pipeline').then((r) => r.json()),
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['invoicing-agents'],
    queryFn: () => fetch('/api/invoicing/agents').then((r) => r.json()),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['crm-accounts'],
    queryFn: () => fetch('/api/accounts?selector=true').then((r) => r.json()),
  })

  const { data: pricing } = useQuery({
    queryKey: ['invoicing-pricing'],
    queryFn: () => fetch('/api/invoicing/pricing').then((r) => r.json()),
    staleTime: 60_000,
  })

  // Expired Accounts tab data
  const { data: allAccounts = [], isLoading: expiredLoading } = useQuery({
    queryKey: ['all-accounts-expired-tab'],
    queryFn: () => fetch('/api/accounts').then((r) => r.json()),
    enabled: tab === 'expired',
  })
  const expiredAccounts = useMemo(
    () => allAccounts.filter((a) => a.status === 'Expired'),
    [allAccounts]
  )
  // ── Mutations ──
  const invalidate = () => qc.invalidateQueries({ queryKey: ['pipeline-leads'] })

  const createM = useMutation({
    mutationFn: (data) => fetch('/api/pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const updateM = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/pipeline/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const stageM = useMutation({
    mutationFn: ({ id, stage, lostReason }) => fetch(`/api/pipeline/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, lostReason }) }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setModal(null); setLostReason('') },
  })

  const deleteM = useMutation({
    mutationFn: (id) => fetch(`/api/pipeline/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => invalidate(),
  })

  const migrateM = useMutation({
    mutationFn: () => fetch('/api/pipeline/migrate', { method: 'POST' }).then((r) => r.json()),
    onSuccess: (data) => { invalidate(); setMigrateResult(data) },
  })

  // ── KPIs ──
  const now = new Date()
  const thisMonth = (d) => { const x = new Date(d); return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth() }

  const kpis = useMemo(() => {
    const inPipeline   = leads.filter((l) => l.stage === 'Lead' || l.stage === 'Qualified').length
    const pipelineVal  = leads.filter((l) => l.stage === 'Qualified').reduce((s, l) => s + (l.estimatedValue || 0), 0)
    const wonThisMonth = leads.filter((l) => l.stage === 'ClosedWon' && l.convertedAt && thisMonth(l.convertedAt)).length
    const totalClosed  = leads.filter((l) => l.stage === 'ClosedWon' || l.stage === 'ClosedLost').length
    const totalWon     = leads.filter((l) => l.stage === 'ClosedWon').length
    const winRate      = totalClosed > 0 ? totalWon / totalClosed : null
    return { inPipeline, pipelineVal, wonThisMonth, winRate }
  }, [leads])

  // ── At-risk count ──
  const atRiskCount = useMemo(() => leads.filter(l => leadRiskStatus(l) !== null).length, [leads])

  // ── Filtered leads ──
  const filtered = useMemo(() => {
    let list = leads
    if (stageFilter === 'at-risk')   list = list.filter((l) => leadRiskStatus(l) !== null)
    else if (stageFilter !== 'all')  list = list.filter((l) => l.stage === stageFilter)
    if (channelFilter)               list = list.filter((l) => l.channel === channelFilter)
    if (countryFilter)               list = list.filter((l) => l.countryCode === countryFilter)
    if (ownerFilter)                 list = list.filter((l) => l.ownerId === ownerFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((l) =>
        l.companyName?.toLowerCase().includes(q) ||
        l.contactName?.toLowerCase().includes(q) ||
        l.contactEmail?.toLowerCase().includes(q)
      )
    }
    return list
  }, [leads, stageFilter, channelFilter, countryFilter, ownerFilter, search])

  // ── Handlers ──
  function openCreate() {
    setFormData({ ...EMPTY_FORM, ownerId: session?.user?.id || '' })
    setFormErrors({})
    setOppType(null)
    setAccountSearch('')
    setSelectedAccount(null)
    setModal('create')
  }

  function openEdit(lead) {
    setFormData({
      companyName:      lead.companyName,
      contactName:      lead.contactName      || '',
      contactEmail:     lead.contactEmail     || '',
      contactPhone:     lead.contactPhone     || '',
      channel:          lead.channel,
      countryCode:      lead.countryCode      || '',
      estimatedValue:   lead.estimatedValue   != null ? String(lead.estimatedValue) : '',
      numberOfBranches: lead.numberOfBranches != null ? String(lead.numberOfBranches) : '',
      branches:         lead.numberOfBranches != null ? String(lead.numberOfBranches) : '',
      packageInterest:  lead.packageInterest  || '',
      opportunityDate:   lead.opportunityDate   ? new Date(lead.opportunityDate).toISOString().slice(0, 10)   : new Date().toISOString().slice(0, 10),
      expectedCloseDate: lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().slice(0, 10) : '',
      notes:            lead.notes            || '',
      ownerId:          lead.ownerId,
    })
    setFormErrors({})
    setModal({ edit: lead })
  }

  function validateForm() {
    const e = {}
    const isExpRen = oppType === 'Expansion' || oppType === 'Renewal'
    if (!isExpRen && !formData.companyName.trim()) e.companyName = 'Required'
    if (isExpRen && !selectedAccount)              e.account     = 'Select an account'
    if (!formData.channel)                         e.channel     = 'Required'
    if (!formData.ownerId)                         e.ownerId     = 'Required'
    return e
  }

  function handleSubmit() {
    const e = validateForm()
    if (Object.keys(e).length > 0) { setFormErrors(e); return }
    const isExpRen = oppType === 'Expansion' || oppType === 'Renewal'
    const payload = {
      ...formData,
      opportunityType:  oppType || 'New',
      numberOfBranches: Number(formData.branches) || null,
      ...(isExpRen && selectedAccount && {
        companyName: selectedAccount.name,
        countryCode: selectedAccount.country?.code || formData.countryCode,
        accountId:   selectedAccount.id,
      }),
    }
    if (modal === 'create') {
      createM.mutate(payload)
    } else if (modal?.edit) {
      updateM.mutate({ id: modal.edit.id, data: { ...formData, numberOfBranches: Number(formData.branches) || null } })
    }
  }

  function handleStageAction(lead, action) {
    if (action === 'ClosedWon') {
      // Gate: required lead fields must be filled before opening the close deal page
      const missing = []
      if (!lead.contactName?.trim())                          missing.push('Contact Name')
      if (!lead.contactEmail?.trim() && !lead.contactPhone?.trim()) missing.push('Contact Email or Phone')
      if (!lead.countryCode)                                  missing.push('Country')
      if (!lead.packageInterest)                              missing.push('Package Interest')
      if (!lead.numberOfBranches || lead.numberOfBranches < 1) missing.push('Number of Branches')
      if (missing.length > 0) {
        setModal({ closedWonBlocked: lead, missing })
        return
      }
      router.push('/pipeline/close/' + lead.id)
      return
    }
    if (action === 'ClosedLost') { setModal({ confirmLoss: lead }); setLostReason(''); return }
    // Direct transitions (Qualify, back to Lead)
    stageM.mutate({ id: lead.id, stage: action })
  }

  function confirmStage(lead, stage, extra = {}) {
    stageM.mutate({ id: lead.id, stage, ...extra })
  }

  // ── Table columns ──
  const tableColumns = [
    { key: 'id',            label: '#',          render: (r) => <span className="text-gray-400">#{r.id}</span> },
    { key: 'companyName',   label: 'Company',    render: (r) => <span className="font-medium text-gray-900">{r.companyName}</span> },
    { key: 'contactName',   label: 'Contact',    render: (r) => <span className="text-gray-500 text-xs">{r.contactName || '—'}</span> },
    { key: 'channel',       label: 'Channel',    render: (r) => <ChannelBadge channel={r.channel} /> },
    { key: 'countryCode',   label: 'Country',    render: (r) => r.countryCode || '—' },
    { key: 'packageInterest',label:'Package',    render: (r) => r.packageInterest || '—' },
    { key: 'estimatedValue',label: 'Est. Value', render: (r) => fmtValue(r.estimatedValue, r.countryCode) || '—' },
    { key: 'stage',         label: 'Stage',      render: (r) => <StageBadge stage={r.stage} /> },
    { key: 'owner',         label: 'Owner',      render: (r) => r.owner?.name || '—' },
    { key: 'createdAt',     label: 'Created',    render: (r) => new Date(r.createdAt).toLocaleDateString() },
    {
      key: 'risk', label: 'Risk', sortable: false,
      render: (r) => {
        const rs = leadRiskStatus(r)
        if (rs === 'overdue') return <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">⚠ Overdue</span>
        if (rs === 'stale') {
          const d = Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / 86400000)
          return <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">💤 {d}d stale</span>
        }
        return <span className="text-gray-300 text-xs">—</span>
      },
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (r) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(r)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
          {r.stage === 'Lead'      && <button onClick={() => handleStageAction(r, 'Qualified')}  className="text-xs text-blue-600 hover:text-blue-800 font-medium">Qualify</button>}
          {r.stage === 'Qualified' && <button onClick={() => handleStageAction(r, 'ClosedWon')}  className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Won</button>}
          {(r.stage === 'Lead' || r.stage === 'Qualified') && <button onClick={() => handleStageAction(r, 'ClosedLost')} className="text-xs text-red-500 hover:text-red-700 font-medium">Lost</button>}
          {isAdmin && <button onClick={() => { if (confirm('Delete this lead?')) deleteM.mutate(r.id) }} className="text-xs text-gray-400 hover:text-red-500 font-medium">Delete</button>}
        </div>
      ),
    },
  ]

  // ── Kanban column data ──
  const byStage = (stageKey) => filtered.filter((l) => l.stage === stageKey)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track leads from first contact to close.</p>
        </div>
        <div className="flex items-center gap-2">
          {atRiskCount > 0 && (
            <button onClick={() => setStageFilter('at-risk')}
              className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors">
              ⚠ {atRiskCount} at risk
            </button>
          )}
          {/* View toggle (leads tab only) */}
          {tab === 'leads' && (
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${view === 'kanban' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>⬛ Kanban</button>
              <button onClick={() => setView('table')}  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${view === 'table'  ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>☰ Table</button>
            </div>
          )}
          {tab === 'leads' && (
            <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">+ New Opportunity</button>
          )}
        </div>
      </div>

      {/* ── Tab toggle ── */}
      <div className="flex items-center border-b border-gray-200 -mb-2">
        <button
          onClick={() => setTab('leads')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'leads' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📋 Leads Pipeline
        </button>
        <button
          onClick={() => setTab('expired')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === 'expired' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          ⏰ Expired Accounts
          {expiredAccounts.length > 0 && (
            <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${tab === 'expired' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
              {expiredAccounts.length}
            </span>
          )}
        </button>
      </div>

      {/* KPIs (leads tab only) */}
      {tab === 'leads' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard label="In Pipeline"    value={kpis.inPipeline}   format="integer" subLabel="Lead + Qualified" />
          <KPICard label="Pipeline Value" value={kpis.pipelineVal}  format="number"  subLabel="Qualified stage" />
          <KPICard label="Won This Month" value={kpis.wonThisMonth} format="integer" subLabel="Closed Won" />
          <KPICard label="Win Rate"       value={kpis.winRate}      format="percent" subLabel="Won ÷ (Won + Lost)" />
        </div>
      )}

      {/* Filters (leads tab only) */}
      {tab === 'leads' && (
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <input
          type="text" placeholder="Search company, contact…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {/* Stage chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {[{ key: 'all', label: 'All' }, ...STAGES].map((s) => (
            <button key={s.key} onClick={() => setStageFilter(s.key)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${stageFilter === s.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.label}
            </button>
          ))}
          <button onClick={() => setStageFilter('at-risk')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${stageFilter === 'at-risk' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
            ⚠ At Risk{atRiskCount > 0 ? ` (${atRiskCount})` : ''}
          </button>
        </div>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Channels</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Countries</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Owners</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {(search || stageFilter !== 'all' || channelFilter || countryFilter || ownerFilter) && (
          <button onClick={() => { setSearch(''); setStageFilter('all'); setChannelFilter(''); setCountryFilter(''); setOwnerFilter('') }} className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} leads</span>
      </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {tab === 'leads' && view === 'kanban' && (
        isLoading ? (
          <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
        ) : (
          <div className="grid grid-cols-4 gap-4 items-start">
            {STAGES.map((s) => {
              const col = byStage(s.key)
              const colVal = col.reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
              const cur    = col[0]?.countryCode ? COUNTRY_CURRENCY[col[0].countryCode] : ''
              return (
                <div key={s.key} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                  {/* Column header */}
                  <div className="px-3 py-2.5 border-b border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span className="text-xs font-semibold text-gray-700">{s.label}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">{col.length}</span>
                    </div>
                    {colVal > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 pl-3.5">{cur} {colVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                    )}
                  </div>
                  {/* Cards */}
                  <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                    {col.length === 0 && (
                      <p className="text-center text-xs text-gray-300 pt-6">No leads</p>
                    )}
                    {col.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onStageAction={handleStageAction} onEdit={openEdit} isAdmin={isAdmin} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── TABLE VIEW ── */}
      {tab === 'leads' && view === 'table' && (
        isLoading ? (
          <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
        ) : (
          <DataTable columns={tableColumns} data={filtered} pageSize={25} exportFilename="pipeline.csv" />
        )
      )}

      {/* ── Admin: Import Existing Accounts ── */}
      {tab === 'leads' && isAdmin && (
        <div className="border border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-between bg-gray-50">
          <div>
            <p className="text-sm font-medium text-gray-700">Import Existing Accounts</p>
            <p className="text-xs text-gray-400">One-time migration: creates pipeline records for all CRM accounts without one. All accounts → Closed Won.</p>
          </div>
          <button onClick={() => setModal('migrate')} className="text-sm bg-white border border-gray-200 hover:border-indigo-400 hover:text-indigo-600 text-gray-600 font-medium px-4 py-2 rounded-xl transition-colors">
            🔄 Import Accounts
          </button>
        </div>
      )}

      {/* ── EXPIRED ACCOUNTS TAB ── */}
      {tab === 'expired' && (
        <div className="space-y-4">
          {expiredLoading ? (
            <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
          ) : expiredAccounts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🎉</p>
              <p className="font-semibold text-gray-600 text-lg">No expired accounts</p>
              <p className="text-sm text-gray-400 mt-1">All accounts are active or have already been resolved.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {expiredAccounts.map((account) => {
                const allContracts = account.contracts || []
                const pendingContracts = allContracts.filter((c) => !c.cancellationDate)
                const lastEndDate = allContracts.length
                  ? new Date(Math.max(...allContracts.map((c) => new Date(c.endDate).getTime())))
                  : null
                const daysExpired = lastEndDate
                  ? Math.floor((Date.now() - lastEndDate.getTime()) / 86400000)
                  : null
                const phase = account.onboarding?.phase
                const phaseLabel = {
                  DealClosure: 'Deal Closure', Onboarding: 'Onboarding', Training: 'Training',
                  Incubation: 'Incubation', AccountManagement: 'Account Mgmt', Expired: 'Expired', Churned: 'Churned',
                }[phase] || phase || '—'
                const phaseCls = {
                  AccountManagement: 'bg-green-100 text-green-700',
                  Expired: 'bg-amber-100 text-amber-700',
                  Churned: 'bg-gray-100 text-gray-500',
                }[phase] || 'bg-gray-100 text-gray-500'
                return (
                  <div key={account.id} className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{account.name}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mt-1">{account.countryCode}</span>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${phaseCls}`}>{phaseLabel}</span>
                    </div>

                    {/* Expiry info */}
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      <p className="text-xs font-medium text-amber-700">
                        ⏰ {daysExpired != null
                          ? (daysExpired === 0 ? 'Expired today' : `Expired ${daysExpired}d ago`)
                          : 'Contracts expired'}
                      </p>
                      {lastEndDate && (
                        <p className="text-xs text-amber-500 mt-0.5">Last end date: {lastEndDate.toLocaleDateString()}</p>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Last MRR</p>
                        <p className="font-semibold text-gray-800 text-sm">
                          USD {(account.totalMRR || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Contracts</p>
                        <p className="font-semibold text-gray-800 text-sm">{pendingContracts.length}</p>
                      </div>
                    </div>

                    {/* CS Owner */}
                    {account.accountManager && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                          {(account.accountManager.name || account.accountManager.email || '?').substring(0, 2).toUpperCase()}
                        </span>
                        <span>{account.accountManager.name || account.accountManager.email}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      <button
                        onClick={() => router.push(`/accounts/${account.id}`)}
                        className="w-full text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg py-1.5 hover:bg-indigo-50 transition-colors"
                      >
                        View Account
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Create Opportunity */}
      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="New Opportunity">
        <div className="space-y-5">
          {/* Step 1: choose type */}
          {!oppType ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">What kind of opportunity is this?</p>
              {OPP_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setOppType(t.key)}
                  className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left"
                >
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Step 2: form based on type */
            <div className="space-y-5">
              {/* Type badge + back link */}
              <div className="flex items-center gap-2">
                <button onClick={() => { setOppType(null); setSelectedAccount(null); setFormErrors({}) }} className="text-xs text-gray-400 hover:text-gray-700 underline">← Back</button>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${OPP_COLORS[oppType]}`}>{oppType}</span>
              </div>

              {/* Expansion / Renewal: account selector */}
              {(oppType === 'Expansion' || oppType === 'Renewal') ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Select Account *</label>
                    <input
                      type="text"
                      placeholder="Search accounts…"
                      value={accountSearch}
                      onChange={(e) => { setAccountSearch(e.target.value); setSelectedAccount(null) }}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${formErrors.account ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                    />
                    {formErrors.account && <p className="text-xs text-red-500 mt-0.5">{formErrors.account}</p>}
                    {accountSearch && !selectedAccount && (
                      <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                        {accounts
                          .filter((a) => a.name.toLowerCase().includes(accountSearch.toLowerCase()))
                          .slice(0, 8)
                          .map((a) => (
                            <button
                              key={a.id}
                              onClick={() => { setSelectedAccount(a); setAccountSearch(a.name) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 border-b border-gray-100 last:border-0"
                            >
                              <span className="font-medium text-gray-900">{a.name}</span>
                              <span className="text-gray-400 text-xs ml-2">{a.country?.code} · {a.numberOfBranches} branches</span>
                            </button>
                          ))
                        }
                        {accounts.filter((a) => a.name.toLowerCase().includes(accountSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-400">No accounts found</p>
                        )}
                      </div>
                    )}
                    {selectedAccount && (
                      <div className="mt-1 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-sm flex items-center justify-between">
                        <span><span className="font-semibold text-indigo-800">{selectedAccount.name}</span> <span className="text-indigo-500 text-xs">{selectedAccount.country?.code} · {selectedAccount.numberOfBranches} branches</span></span>
                        <button onClick={() => { setSelectedAccount(null); setAccountSearch('') }} className="text-indigo-400 hover:text-indigo-700 text-xs">✕</button>
                      </div>
                    )}
                  </div>
                  {/* Lead details for expansion/renewal (no company name — taken from account) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Channel *</label>
                      <select
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${formErrors.channel ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                        value={formData.channel} onChange={(e) => setFormData((p) => ({ ...p, channel: e.target.value }))}>
                        <option value="">Select channel…</option>
                        {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      {formErrors.channel && <p className="text-xs text-red-500 mt-0.5">{formErrors.channel}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Owner *</label>
                      <select
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${formErrors.ownerId ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                        value={formData.ownerId} onChange={(e) => setFormData((p) => ({ ...p, ownerId: e.target.value }))}>
                        <option value="">Assign to…</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      {formErrors.ownerId && <p className="text-xs text-red-500 mt-0.5">{formErrors.ownerId}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Package Interest</label>
                      <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={formData.packageInterest} onChange={(e) => setFormData((p) => ({ ...p, packageInterest: e.target.value }))}>
                        <option value="">Any</option>
                        {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected Close Date</label>
                      <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={formData.expectedCloseDate} onChange={(e) => setFormData((p) => ({ ...p, expectedCloseDate: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
                      <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                        value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes…" />
                    </div>
                  </div>
                </div>
              ) : (
                /* New: standard lead form */
                <LeadForm form={formData} setForm={setFormData} errors={formErrors} agents={agents} pricing={pricing} />
              )}

              {(createM.data?.error) && (
                <p className="text-sm text-red-500">{createM.data.error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSubmit} disabled={createM.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors">
                  {createM.isPending ? 'Saving…' : `Create ${oppType} Opportunity`}
                </button>
                <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Lead */}
      <Modal isOpen={!!modal?.edit} onClose={() => setModal(null)} title="Edit Opportunity">
        <div className="space-y-5">
          <LeadForm form={formData} setForm={setFormData} errors={formErrors} agents={agents} pricing={pricing} />
          {updateM.data?.error && (
            <p className="text-sm text-red-500">{updateM.data.error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={updateM.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors">
              {updateM.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Confirm Lost */}
      <Modal isOpen={!!modal?.confirmLoss} onClose={() => setModal(null)} title="Mark as Closed Lost">
        {modal?.confirmLoss && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Why was <strong>{modal.confirmLoss.companyName}</strong> lost? (optional)</p>
            <textarea
              rows={3} value={lostReason} onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Chose a competitor, budget constraints…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => confirmStage(modal.confirmLoss, 'ClosedLost', { lostReason })} disabled={stageM.isPending} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors">
                {stageM.isPending ? 'Saving…' : 'Confirm Lost'}
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Close Won Blocked — missing required fields */}
      <Modal isOpen={!!modal?.closedWonBlocked} onClose={() => setModal(null)} title="Complete lead before closing">
        {modal?.closedWonBlocked && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Fill in the following required fields on <strong>{modal.closedWonBlocked.companyName}</strong> before closing as Won:
            </p>
            <ul className="space-y-1.5">
              {modal.missing.map((field) => (
                <li key={field} className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <span className="text-red-500 font-bold">✕</span>
                  {field}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { openEdit(modal.closedWonBlocked); }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                ✎ Edit Lead
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Migration */}
      <Modal isOpen={modal === 'migrate'} onClose={() => { setModal(null); setMigrateResult(null) }} title="Import Existing Accounts">
        <div className="space-y-4">
          {!migrateResult ? (
            <>
              <p className="text-sm text-gray-600">This will create pipeline records for all CRM accounts that don't already have one:</p>
              <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
                <li>All accounts → <strong>Closed Won</strong> stage</li>
              </ul>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This operation is safe to run multiple times — already-linked accounts are skipped.</p>
              <div className="flex gap-3">
                <button onClick={() => migrateM.mutate()} disabled={migrateM.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors">
                  {migrateM.isPending ? 'Importing…' : 'Run Import'}
                </button>
                <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1">
                <p className="text-3xl font-bold text-emerald-700">{migrateResult.created}</p>
                <p className="text-sm text-emerald-600">leads created</p>
                {migrateResult.skipped > 0 && <p className="text-xs text-gray-400">{migrateResult.skipped} already linked — skipped</p>}
              </div>
              <button onClick={() => { setModal(null); setMigrateResult(null) }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors">Done</button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
