'use client'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { calcDealSummary } from '@/lib/invoicingCalc'

const PACKAGES   = ['Essential', 'Operations', 'Enterprise']
const PAY_TYPES  = ['Annual', 'Quarterly', 'Special']
const POS_SYSTEMS = ['Foodics', 'Geidea', 'Sonic']
const DEAL_TYPES = ['New', 'Renewal', 'Upsell']
const CHANNELS   = ['Direct', 'Partner', 'Ambassador', 'Online']

const EMPTY = {
  accountName: '',
  brandNames: '',
  numberOfBrands: 1,
  startDate: new Date().toISOString().slice(0, 10),
  dealType: 'New',
  posSystem: 'Foodics',
  countryCode: '',
  salesChannel: 'Direct',
  package: 'Essential',
  paymentType: 'Annual',
  contractYears: 1,
  agentId: '',
  normalBranches: 0,
  centralKitchens: 0,
  warehouses: 0,
  hasAccounting: false,
  extraAccountingBranches: 0,
  hasButchering: false,
  aiAgentUsers: 0,
  notes: '',
}

function fmt(n, currency = '') {
  const num = Number(n) || 0
  return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
}

export default function DealCalculatorPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [modal, setModal] = useState(null) // 'confirm' | 'success'
  const [createdDeal, setCreatedDeal] = useState(null)
  const [linkedAccountId, setLinkedAccountId] = useState(null) // set from lead when opened via Start Deal

  // Pre-fill from pipeline "Start Deal" navigation
  const searchParams = useSearchParams()
  useEffect(() => {
    const accountName = searchParams.get('accountName')
    const country     = searchParams.get('country')
    const leadId      = searchParams.get('leadId')
    if (accountName || country) {
      setForm(prev => ({
        ...prev,
        ...(accountName && { accountName }),
        ...(country     && { countryCode: country }),
      }))
    }
    // Fetch the lead's linked accountId so the deal gets associated
    if (leadId) {
      fetch(`/api/pipeline/${leadId}`)
        .then((r) => r.json())
        .then((lead) => {
          if (lead?.accountId) setLinkedAccountId(lead.accountId)
        })
        .catch(() => {}) // non-blocking
    }
  }, []) // mount only

  const { data: pricing } = useQuery({
    queryKey: ['invoicing-pricing'],
    queryFn: () => fetch('/api/invoicing/pricing').then((r) => r.json()),
    staleTime: 60_000,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['invoicing-agents'],
    queryFn: () => fetch('/api/invoicing/agents').then((r) => r.json()),
  })

  const countries = pricing?.countries || []
  const selectedCountry = countries.find((c) => c.code === form.countryCode)
  const currency = selectedCountry?.currency || ''
  const vatRate  = Number(selectedCountry?.vatRate || 0)

  // Live summary — recomputed client-side
  const summary = useMemo(() => {
    if (!pricing || !form.countryCode || !form.package) return null
    return calcDealSummary({
      normalBranches:          Number(form.normalBranches)          || 0,
      centralKitchens:         Number(form.centralKitchens)         || 0,
      warehouses:              Number(form.warehouses)              || 0,
      hasAccounting:           form.hasAccounting,
      extraAccountingBranches: Number(form.extraAccountingBranches) || 0,
      hasButchering:           form.hasButchering,
      aiAgentUsers:            Number(form.aiAgentUsers)            || 0,
      countryCode:             form.countryCode,
      package:                 form.package,
      paymentType:             form.paymentType,
      contractYears:           Number(form.contractYears)           || 1,
      vatRate,
      branchPricing:           pricing.branchPricing     || [],
      accountingPricing:       pricing.accountingPricing || [],
      flatModulePricing:       pricing.flatModulePricing || [],
    })
  }, [form, pricing, vatRate])

  const invoiceCount = form.paymentType === 'Quarterly' ? 4 : 1

  const create = useMutation({
    mutationFn: (data) =>
      fetch('/api/invoicing/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Failed')
        return json
      }),
    onSuccess: (deal) => {
      qc.invalidateQueries(['invoicing-deals'])
      qc.invalidateQueries(['invoicing-invoices'])
      qc.invalidateQueries(['invoicing-ar-report'])
      setCreatedDeal(deal)
      setModal('success')
    },
  })

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.accountName.trim()) e.accountName = 'Required'
    if (!form.countryCode)         e.countryCode = 'Required'
    if (!form.package)             e.package     = 'Required'
    if (!form.agentId)             e.agentId     = 'Required'
    return e
  }

  function handleConfirmClick() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setModal('confirm')
  }

  function handleSubmit() {
    create.mutate({
      ...form,
      normalBranches:          Number(form.normalBranches)          || 0,
      centralKitchens:         Number(form.centralKitchens)         || 0,
      warehouses:              Number(form.warehouses)              || 0,
      extraAccountingBranches: Number(form.extraAccountingBranches) || 0,
      aiAgentUsers:            Number(form.aiAgentUsers)            || 0,
      numberOfBrands:          Number(form.numberOfBrands)          || 1,
      contractYears:           Number(form.contractYears)           || 1,
      ...(linkedAccountId && { accountId: linkedAccountId }),
    })
  }

  function handleClear() {
    setForm(EMPTY)
    setErrors({})
    setCreatedDeal(null)
    setModal(null)
  }

  const fieldClass = (key) =>
    `text-sm border rounded-xl px-3 py-2 bg-white w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[key] ? 'border-red-400' : 'border-gray-200'}`

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Deal Calculator</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fill in deal details to generate a quote and confirm the deal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Form ────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Account Details */}
          <Section title="Account Details">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Account Name *</label>
                <input className={fieldClass('accountName')} value={form.accountName} onChange={(e) => set('accountName', e.target.value)} placeholder="e.g. Al Baik Restaurant Group" />
                {errors.accountName && <p className="text-xs text-red-500 mt-1">{errors.accountName}</p>}
              </div>
              <div>
                <label className="label">Brand Name(s)</label>
                <input className={fieldClass('brandNames')} value={form.brandNames} onChange={(e) => set('brandNames', e.target.value)} placeholder="Comma-separated" />
              </div>
              <div>
                <label className="label"># of Brands</label>
                <input type="number" min={1} className={fieldClass('numberOfBrands')} value={form.numberOfBrands} onChange={(e) => set('numberOfBrands', e.target.value)} />
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" className={fieldClass('startDate')} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Deal Type</label>
                <select className={fieldClass('dealType')} value={form.dealType} onChange={(e) => set('dealType', e.target.value)}>
                  {DEAL_TYPES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </Section>

          {/* Deal Config */}
          <Section title="Deal Configuration">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">POS System</label>
                <select className={fieldClass('posSystem')} value={form.posSystem} onChange={(e) => set('posSystem', e.target.value)}>
                  {POS_SYSTEMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Country *</label>
                <select className={fieldClass('countryCode')} value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)}>
                  <option value="">Select country…</option>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                {errors.countryCode && <p className="text-xs text-red-500 mt-1">{errors.countryCode}</p>}
              </div>
              <div>
                <label className="label">Package *</label>
                <select className={fieldClass('package')} value={form.package} onChange={(e) => set('package', e.target.value)}>
                  {PACKAGES.map((p) => <option key={p}>{p}</option>)}
                </select>
                {errors.package && <p className="text-xs text-red-500 mt-1">{errors.package}</p>}
              </div>
              <div>
                <label className="label">Payment Type</label>
                <select className={fieldClass('paymentType')} value={form.paymentType} onChange={(e) => set('paymentType', e.target.value)}>
                  {PAY_TYPES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              {form.paymentType === 'Special' && (
                <div>
                  <label className="label">Contract Years</label>
                  <input type="number" min={1} className={fieldClass('contractYears')} value={form.contractYears} onChange={(e) => set('contractYears', e.target.value)} />
                </div>
              )}
              <div>
                <label className="label">Sales Channel</label>
                <select className={fieldClass('salesChannel')} value={form.salesChannel} onChange={(e) => set('salesChannel', e.target.value)}>
                  {CHANNELS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sales Agent *</label>
                <select className={fieldClass('agentId')} value={form.agentId} onChange={(e) => set('agentId', e.target.value)}>
                  <option value="">Select agent…</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                </select>
                {errors.agentId && <p className="text-xs text-red-500 mt-1">{errors.agentId}</p>}
              </div>
            </div>
          </Section>

          {/* Branch Configuration */}
          <Section title="Branch Configuration">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Normal Branches</label>
                <input type="number" min={0} className={fieldClass('normalBranches')} value={form.normalBranches} onChange={(e) => set('normalBranches', e.target.value)} />
              </div>
              <div>
                <label className="label">Central Kitchens</label>
                <input type="number" min={0} className={fieldClass('centralKitchens')} value={form.centralKitchens} onChange={(e) => set('centralKitchens', e.target.value)} />
              </div>
              <div>
                <label className="label">Warehouses</label>
                <input type="number" min={0} className={fieldClass('warehouses')} value={form.warehouses} onChange={(e) => set('warehouses', e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Add-on Modules */}
          <Section title="Add-on Modules">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="hasAccounting" checked={form.hasAccounting} onChange={(e) => set('hasAccounting', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                <label htmlFor="hasAccounting" className="text-sm text-gray-700 font-medium">Accounting Module</label>
              </div>
              {form.hasAccounting && (
                <div>
                  <label className="label">Extra Accounting Branches</label>
                  <input type="number" min={0} className={fieldClass('extraAccountingBranches')} value={form.extraAccountingBranches} onChange={(e) => set('extraAccountingBranches', e.target.value)} />
                </div>
              )}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="hasButchering" checked={form.hasButchering} onChange={(e) => set('hasButchering', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                <label htmlFor="hasButchering" className="text-sm text-gray-700 font-medium">Butchering Module</label>
              </div>
              <div>
                <label className="label">AI Agent Named Users</label>
                <input type="number" min={0} className={fieldClass('aiAgentUsers')} value={form.aiAgentUsers} onChange={(e) => set('aiAgentUsers', e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <textarea className={`${fieldClass('notes')} h-20 resize-none`} placeholder="Optional notes…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Section>

          <button onClick={handleConfirmClick} className="w-full bg-indigo-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors">
            Confirm Deal →
          </button>
        </div>

        {/* ── Right: Live Preview ───────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm sticky top-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Live Preview</p>

            {!summary ? (
              <p className="text-sm text-gray-400">Select country and package to see pricing.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <PreviewRow label="Branch MRR"      value={fmt(summary.branchMRR, currency)} />
                <PreviewRow label="Accounting MRR"  value={fmt(summary.accountingMRR, currency)} />
                <PreviewRow label="Add-on MRR"      value={fmt(summary.flatMRR, currency)} />
                <div className="border-t border-gray-100 pt-3">
                  <PreviewRow label="Total MRR (excl. VAT)" value={fmt(summary.totalMRR, currency)} bold />
                  <PreviewRow label={`VAT (${(vatRate * 100).toFixed(0)}%)`} value={fmt(summary.totalMRR * vatRate, currency)} />
                  <PreviewRow label="Total MRR (incl. VAT)" value={fmt(summary.totalMRRInclVAT, currency)} bold />
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <PreviewRow label="Contract Months"           value={`${summary.contractMonths} months`} />
                  <PreviewRow label="Contract Value (excl. VAT)" value={fmt(summary.contractValue, currency)} bold />
                  <PreviewRow label="Contract Value (incl. VAT)" value={fmt(summary.contractValueInclVAT, currency)} bold />
                </div>
                {form.paymentType === 'Quarterly' && (
                  <div className="border-t border-gray-100 pt-3">
                    <PreviewRow label="Quarterly Billing (excl.)" value={fmt(summary.quarterlyBilling, currency)} />
                    <PreviewRow label="Quarterly Billing (incl.)" value={fmt(summary.quarterlyBillingInclVAT, currency)} />
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3 text-xs text-gray-500">
                  {invoiceCount} invoice{invoiceCount > 1 ? 's' : ''} will be created
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ──────────────────────────────── */}
      <Modal isOpen={modal === 'confirm'} onClose={() => setModal(null)} title="Confirm Deal">
        {summary && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <DLRow label="Account"       value={form.accountName} />
              <DLRow label="Brand(s)"      value={form.brandNames || '—'} />
              <DLRow label="# Brands"      value={form.numberOfBrands} />
              <DLRow label="Country"       value={selectedCountry?.name || form.countryCode} />
              <DLRow label="Package"       value={form.package} />
              <DLRow label="POS System"    value={form.posSystem} />
              <DLRow label="Payment Type"  value={form.paymentType} />
              <DLRow label="Agent"         value={agents.find((a) => a.id === form.agentId)?.name || '—'} />
              <DLRow label="MRR (excl. VAT)" value={fmt(summary.totalMRR, currency)} />
              <DLRow label="MRR (incl. VAT)" value={fmt(summary.totalMRRInclVAT, currency)} />
              <DLRow label="Contract Value (excl.)" value={fmt(summary.contractValue, currency)} />
              <DLRow label="Contract Value (incl.)" value={fmt(summary.contractValueInclVAT, currency)} />
              <DLRow label="Invoices to create" value={invoiceCount} />
            </dl>
            {create.error && <p className="text-sm text-red-500">{create.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} disabled={create.isPending} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {create.isPending ? 'Creating…' : 'Yes, Confirm Deal'}
              </button>
              <button onClick={() => setModal(null)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Success Modal ──────────────────────────────── */}
      <Modal isOpen={modal === 'success'} onClose={handleClear} title="Deal Confirmed!">
        {createdDeal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Deal for <strong>{createdDeal.accountName}</strong> has been confirmed. The following invoices were created:</p>
            <ul className="space-y-1">
              {createdDeal.invoices?.map((inv) => (
                <li key={inv.id} className="text-sm font-mono bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  {inv.invoiceNumber} — {new Date(inv.invoiceDate).toLocaleDateString()} — {currency} {Number(inv.amountInclVAT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 pt-2">
              <a href="/invoicing/invoices" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors text-center">
                Go to Invoices
              </a>
              <button onClick={handleClear} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                Clear Form
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

function PreviewRow({ label, value, bold }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-gray-500 ${bold ? 'font-semibold text-gray-700' : ''}`}>{label}</span>
      <span className={`font-mono ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

function DLRow({ label, value }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </>
  )
}
