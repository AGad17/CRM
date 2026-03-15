'use client'
import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { calcDealSummary } from '@/lib/invoicingCalc'

// ─── Constants ───────────────────────────────────────────────────────────────

const PACKAGES    = ['Essential', 'Operations', 'Enterprise']
const PAY_TYPES   = ['Annual', 'Quarterly', 'Special']
const POS_SYSTEMS = ['Foodics', 'Geidea', 'Sonic']
const DEAL_TYPES  = ['New', 'Renewal', 'Expansion', 'Upsell']

const CHANNELS = [
  { value: 'Foodics',            label: 'Foodics' },
  { value: 'DirectSales',        label: 'Direct Sales' },
  { value: 'PartnerReferral',    label: 'Partner Referral' },
  { value: 'CustomerReferral',   label: 'Customer Referral' },
  { value: 'EmployeeReferral',   label: 'Employee Referral' },
  { value: 'AmbassadorReferral', label: 'Ambassador Referral' },
  { value: 'Website',            label: 'Website' },
  { value: 'Sonic',              label: 'Sonic' },
]

const EMPTY_ACCOUNT = { accountName: '', brands: 1, numberOfBranches: 1, numberOfCostCentres: '' }
const EMPTY_DEAL = {
  brandNames: '', numberOfBrands: 1,
  startDate: new Date().toISOString().slice(0, 10),
  dealType: 'New', posSystem: 'Foodics', countryCode: '',
  salesChannel: 'DirectSales', package: 'Essential',
  paymentType: 'Annual', contractYears: 1, agentId: '',
  normalBranches: 0, centralKitchens: 0, warehouses: 0,
  hasAccounting: false, extraAccountingBranches: 0,
  hasButchering: false, aiAgentUsers: 0, notes: '',
  discount: '',         // overall deal discount %
  foodicsInvoiceNumber: '', // first Foodics invoice # (Foodics deals only)
}

const EMPTY_LINE_DISCOUNTS = {
  inventory: '', ck: '', warehouse: '', accMain: '', accExtra: '', butchering: '', ai: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n, currency = '') {
  const num = Number(n) || 0
  return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

function PreviewRow({ label, value, bold, highlight }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-700' : 'text-gray-500'} ${highlight ? 'text-indigo-600 font-medium' : ''}`}>{label}</span>
      <span className={`font-mono text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-700'} ${highlight ? 'text-indigo-600' : ''}`}>{value}</span>
    </div>
  )
}

function DiscountInput({ value, onChange, placeholder = '0' }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 text-right"
        placeholder={placeholder}
      />
      <span className="text-xs text-gray-400">%</span>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CloseDealPage() {
  const { leadId } = useParams()
  const router = useRouter()
  const { data: session } = useSession()

  const [account, setAccount]             = useState(EMPTY_ACCOUNT)
  const [deal, setDeal]                   = useState(EMPTY_DEAL)
  const [lineDiscounts, setLineDiscounts] = useState(EMPTY_LINE_DISCOUNTS)
  const [errors, setErrors]               = useState({})
  const [modal, setModal]                 = useState(null)
  const [prefilled, setPrefilled]         = useState(false)

  // ── Data ──
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['pipeline-lead', leadId],
    queryFn:  () => fetch(`/api/pipeline/${leadId}`).then((r) => r.json()),
    staleTime: 30_000,
  })

  const { data: pricing } = useQuery({
    queryKey: ['invoicing-pricing'],
    queryFn:  () => fetch('/api/invoicing/pricing').then((r) => r.json()),
    staleTime: 60_000,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['invoicing-agents'],
    queryFn:  () => fetch('/api/invoicing/agents').then((r) => r.json()),
  })

  // ── Pre-fill from lead ──
  useEffect(() => {
    if (lead && !lead.error && !prefilled) {
      const oppType = lead.opportunityType
      const accountName = lead.account?.name || lead.companyName || ''
      setAccount((prev) => ({ ...prev, accountName }))
      setDeal((prev) => ({
        ...prev,
        brandNames:   accountName,
        countryCode:  lead.countryCode  || (lead.account?.country?.code ?? ''),
        agentId:      lead.ownerId      || session?.user?.id || '',
        salesChannel: lead.channel      || prev.salesChannel,
        ...(lead.packageInterest && { package: lead.packageInterest }),
        // Lock deal type to opportunity type for expansion/renewal
        ...(oppType === 'Expansion' && { dealType: 'Expansion' }),
        ...(oppType === 'Renewal'   && { dealType: 'Renewal' }),
      }))
      setPrefilled(true)
    }
  }, [lead, prefilled, session])

  // ── Derived ──
  const countries       = pricing?.countries || []
  const selectedCountry = countries.find((c) => c.code === deal.countryCode)
  const currency        = selectedCountry?.currency || ''
  const vatRate         = Number(selectedCountry?.vatRate || 0)
  const invoiceCount    = deal.paymentType === 'Quarterly' ? 4 : 1

  const summary = useMemo(() => {
    if (!pricing || !deal.countryCode || !deal.package || !deal.salesChannel) return null
    return calcDealSummary({
      normalBranches:          Number(deal.normalBranches)          || 0,
      centralKitchens:         Number(deal.centralKitchens)         || 0,
      warehouses:              Number(deal.warehouses)              || 0,
      hasAccounting:           deal.hasAccounting,
      extraAccountingBranches: Number(deal.extraAccountingBranches) || 0,
      hasButchering:           deal.hasButchering,
      aiAgentUsers:            Number(deal.aiAgentUsers)            || 0,
      countryCode:             deal.countryCode,
      salesChannel:            deal.salesChannel,
      package:                 deal.package,
      paymentType:             deal.paymentType,
      contractYears:           Number(deal.contractYears) || 1,
      vatRate,
      discount:                Number(deal.discount) || 0,
      lineDiscounts: {
        inventory:  Number(lineDiscounts.inventory)  || 0,
        ck:         Number(lineDiscounts.ck)         || 0,
        warehouse:  Number(lineDiscounts.warehouse)  || 0,
        accMain:    Number(lineDiscounts.accMain)    || 0,
        accExtra:   Number(lineDiscounts.accExtra)   || 0,
        butchering: Number(lineDiscounts.butchering) || 0,
        ai:         Number(lineDiscounts.ai)         || 0,
      },
      inventoryPricing: pricing.inventoryPricing || [],
      addOnPricing:     pricing.addOnPricing     || [],
    })
  }, [deal, lineDiscounts, pricing, vatRate])

  // ── Setters ──
  const setA  = (key) => (e) => {
    setAccount((p) => ({ ...p, [key]: e.target.value }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }))
  }
  const setD  = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setDeal((p) => ({ ...p, [key]: v }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }))
  }
  const setLD = (key) => (v) => setLineDiscounts((p) => ({ ...p, [key]: v }))

  // ── Validation ──
  function validate() {
    const e = {}
    if (!account.accountName.trim()) e.accountName = 'Required'
    if (!deal.countryCode)           e.countryCode  = 'Required'
    if (!deal.package)               e.package      = 'Required'
    if (!deal.agentId)               e.agentId      = 'Required'
    if (!deal.posSystem)             e.posSystem    = 'Required'
    return e
  }

  function handleReview() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setModal('confirm')
  }

  // ── Mutation ──
  const closeMutation = useMutation({
    mutationFn: (data) =>
      fetch(`/api/pipeline/${leadId}/close`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Failed to close deal')
        return json
      }),
    onSuccess: (data) => {
      router.push(`/accounts/${data.account.id}`)
    },
  })

  function handleConfirm() {
    closeMutation.mutate({
      // Account fields
      accountName:         account.accountName.trim(),
      brands:              Number(account.brands)             || 1,
      numberOfBranches:    Number(account.numberOfBranches)   || 1,
      numberOfCostCentres: account.numberOfCostCentres ? Number(account.numberOfCostCentres) : null,
      // Deal fields
      country:                 deal.countryCode,
      brandNames:              deal.brandNames || account.accountName.trim(),
      numberOfBrands:          Number(deal.numberOfBrands)          || 1,
      startDate:               deal.startDate,
      dealType:                deal.dealType,
      posSystem:               deal.posSystem,
      salesChannel:            deal.salesChannel,
      package:                 deal.package,
      paymentType:             deal.paymentType,
      contractYears:           Number(deal.contractYears)           || 1,
      agentId:                 deal.agentId,
      normalBranches:          Number(deal.normalBranches)          || 0,
      centralKitchens:         Number(deal.centralKitchens)         || 0,
      warehouses:              Number(deal.warehouses)              || 0,
      hasAccounting:           deal.hasAccounting,
      extraAccountingBranches: Number(deal.extraAccountingBranches) || 0,
      hasButchering:           deal.hasButchering,
      aiAgentUsers:            Number(deal.aiAgentUsers)            || 0,
      notes:                   deal.notes,
      discount:                Number(deal.discount) || 0,
      foodicsInvoiceNumber:    deal.foodicsInvoiceNumber?.trim() || null,
      lineDiscounts: {
        inventory:  Number(lineDiscounts.inventory)  || 0,
        ck:         Number(lineDiscounts.ck)         || 0,
        warehouse:  Number(lineDiscounts.warehouse)  || 0,
        accMain:    Number(lineDiscounts.accMain)    || 0,
        accExtra:   Number(lineDiscounts.accExtra)   || 0,
        butchering: Number(lineDiscounts.butchering) || 0,
        ai:         Number(lineDiscounts.ai)         || 0,
      },
    })
  }

  const fc = (key) =>
    `text-sm border rounded-xl px-3 py-2 bg-white w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[key] ? 'border-red-400' : 'border-gray-200'}`

  // ── Loading / Error states ──
  if (leadLoading) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
  if (!lead || lead.error) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg font-medium">Lead not found</p>
        <Link href="/pipeline" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">← Back to Pipeline</Link>
      </div>
    )
  }
  if (lead.stage === 'ClosedWon') {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg font-medium">This lead is already closed</p>
        {lead.accountId && (
          <Link href={`/accounts/${lead.accountId}`} className="text-indigo-600 hover:underline text-sm mt-2 inline-block">View Account →</Link>
        )}
        <div className="mt-2">
          <Link href="/pipeline" className="text-gray-400 hover:text-gray-700 text-sm">← Back to Pipeline</Link>
        </div>
      </div>
    )
  }

  const hasBranches   = Number(deal.normalBranches) > 0
  const hasCK         = Number(deal.centralKitchens) > 0
  const hasWarehouse  = Number(deal.warehouses) > 0
  const hasAI         = Number(deal.aiAgentUsers) > 0

  // ── Render ──
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pipeline" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Pipeline</Link>
        <span className="text-gray-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Close Deal — {lead.companyName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the contract details. The account and invoices will be created automatically.</p>
        </div>
      </div>

      {/* Lead context banner */}
      {(() => {
        const oppType = lead.opportunityType
        const isExpRen = oppType === 'Expansion' || oppType === 'Renewal'
        const bannerLabel = oppType === 'Expansion' ? '📈 Expansion Deal' : oppType === 'Renewal' ? '🔄 Renewal' : '🎉 Closing Won'
        return (
          <div className={`border rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${isExpRen ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <span className={`font-semibold ${isExpRen ? 'text-indigo-600' : 'text-emerald-600'}`}>{bannerLabel}</span>
            <span className={`font-medium ${isExpRen ? 'text-indigo-700' : 'text-emerald-700'}`}>{lead.account?.name || lead.companyName}</span>
            {lead.countryCode     && <span className={isExpRen ? 'text-indigo-600' : 'text-emerald-600'}>{lead.countryCode}</span>}
            {lead.packageInterest && <span className={`rounded-full px-2 py-0.5 ${isExpRen ? 'text-indigo-600 bg-indigo-100' : 'text-emerald-600 bg-emerald-100'}`}>{lead.packageInterest}</span>}
            {lead.estimatedValue  && <span className={`font-mono ${isExpRen ? 'text-indigo-700' : 'text-emerald-700'}`}>{Number(lead.estimatedValue).toLocaleString()} est.</span>}
            {lead.channel         && <span className="text-gray-400">via {lead.channel}</span>}
            {isExpRen             && <span className="text-xs text-indigo-500 italic">Existing account — no new account will be created</span>}
          </div>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Form ────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Account Details */}
          {lead.opportunityType === 'Expansion' || lead.opportunityType === 'Renewal' ? (
            <Section title="Account">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm">
                <p className="font-semibold text-indigo-800">{lead.account?.name || account.accountName}</p>
                <p className="text-indigo-500 text-xs mt-0.5">Existing account · deal will be added to this account's history</p>
              </div>
            </Section>
          ) : (
            <Section title="Account Details">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Name *</label>
                  <input className={fc('accountName')} value={account.accountName} onChange={setA('accountName')} placeholder="e.g. Al Baik Restaurant Group" />
                  {errors.accountName && <p className="text-xs text-red-500 mt-1">{errors.accountName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of Brands</label>
                  <input type="number" min={1} className={fc('brands')} value={account.brands} onChange={setA('brands')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total Branches</label>
                  <input type="number" min={1} className={fc('numberOfBranches')} value={account.numberOfBranches} onChange={setA('numberOfBranches')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cost Centres</label>
                  <input type="number" min={0} className={fc('numberOfCostCentres')} value={account.numberOfCostCentres} onChange={setA('numberOfCostCentres')} placeholder="Optional" />
                </div>
              </div>
            </Section>
          )}

          {/* Deal Configuration */}
          <Section title="Contract & Deal Configuration">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">POS System *</label>
                <select className={fc('posSystem')} value={deal.posSystem} onChange={setD('posSystem')}>
                  {POS_SYSTEMS.map((p) => <option key={p}>{p}</option>)}
                </select>
                {errors.posSystem && <p className="text-xs text-red-500 mt-1">{errors.posSystem}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Country *</label>
                <select className={fc('countryCode')} value={deal.countryCode} onChange={setD('countryCode')}>
                  <option value="">Select country…</option>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                {errors.countryCode && <p className="text-xs text-red-500 mt-1">{errors.countryCode}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sales Channel *</label>
                <select className={fc('salesChannel')} value={deal.salesChannel} onChange={setD('salesChannel')}>
                  {CHANNELS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Package *</label>
                <select className={fc('package')} value={deal.package} onChange={setD('package')}>
                  {PACKAGES.map((p) => <option key={p}>{p}</option>)}
                </select>
                {errors.package && <p className="text-xs text-red-500 mt-1">{errors.package}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
                <select className={fc('paymentType')} value={deal.paymentType} onChange={setD('paymentType')}>
                  {PAY_TYPES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              {deal.paymentType === 'Special' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contract Years</label>
                  <input type="number" min={1} className={fc('contractYears')} value={deal.contractYears} onChange={setD('contractYears')} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Deal Type</label>
                <select className={fc('dealType')} value={deal.dealType} onChange={setD('dealType')}>
                  {DEAL_TYPES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input type="date" className={fc('startDate')} value={deal.startDate} onChange={setD('startDate')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sales Agent *</label>
                <select className={fc('agentId')} value={deal.agentId} onChange={setD('agentId')}>
                  <option value="">Select agent…</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                </select>
                {errors.agentId && <p className="text-xs text-red-500 mt-1">{errors.agentId}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Brand Name(s)</label>
                <input className={fc('brandNames')} value={deal.brandNames} onChange={setD('brandNames')} placeholder="Comma-separated if multiple" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1"># of Brands</label>
                <input type="number" min={1} className={fc('numberOfBrands')} value={deal.numberOfBrands} onChange={setD('numberOfBrands')} />
              </div>
            </div>
          </Section>

          {/* Branch Configuration + per-line discounts */}
          <Section title="Branch Configuration">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
                <span>Branch Type</span>
                <span>Quantity</span>
                <span>Line Discount</span>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-sm text-gray-700">Normal Branches</label>
                <input type="number" min={0} className={fc('normalBranches')} value={deal.normalBranches} onChange={setD('normalBranches')} />
                {hasBranches ? <DiscountInput value={lineDiscounts.inventory} onChange={setLD('inventory')} /> : <span className="text-gray-300 text-xs pl-1">—</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-sm text-gray-700">Central Kitchens</label>
                <input type="number" min={0} className={fc('centralKitchens')} value={deal.centralKitchens} onChange={setD('centralKitchens')} />
                {hasCK ? <DiscountInput value={lineDiscounts.ck} onChange={setLD('ck')} /> : <span className="text-gray-300 text-xs pl-1">—</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-sm text-gray-700">Warehouses</label>
                <input type="number" min={0} className={fc('warehouses')} value={deal.warehouses} onChange={setD('warehouses')} />
                {hasWarehouse ? <DiscountInput value={lineDiscounts.warehouse} onChange={setLD('warehouse')} /> : <span className="text-gray-300 text-xs pl-1">—</span>}
              </div>
            </div>
          </Section>

          {/* Add-on Modules + per-line discounts */}
          <Section title="Add-on Modules">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
                <span className="col-span-2">Module</span>
                <span>Line Discount</span>
              </div>

              {/* Accounting Main */}
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="hasAccounting" checked={deal.hasAccounting} onChange={setD('hasAccounting')} className="w-4 h-4 accent-indigo-600" />
                  <label htmlFor="hasAccounting" className="text-sm text-gray-700">Accounting (Main License)</label>
                </div>
                {deal.hasAccounting ? <DiscountInput value={lineDiscounts.accMain} onChange={setLD('accMain')} /> : <span className="text-gray-300 text-xs pl-1">—</span>}
              </div>

              {/* Accounting Extra Branches */}
              {deal.hasAccounting && (
                <div className="grid grid-cols-3 gap-2 items-center ml-6">
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Extra Acct. Branches</label>
                    <input type="number" min={0} className={fc('extraAccountingBranches')} value={deal.extraAccountingBranches} onChange={setD('extraAccountingBranches')} />
                  </div>
                  <div />
                  {Number(deal.extraAccountingBranches) > 0
                    ? <DiscountInput value={lineDiscounts.accExtra} onChange={setLD('accExtra')} />
                    : <span className="text-gray-300 text-xs pl-1">—</span>}
                </div>
              )}

              {/* Butchering */}
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="hasButchering" checked={deal.hasButchering} onChange={setD('hasButchering')} className="w-4 h-4 accent-indigo-600" />
                  <label htmlFor="hasButchering" className="text-sm text-gray-700">Butchering Module</label>
                </div>
                {deal.hasButchering ? <DiscountInput value={lineDiscounts.butchering} onChange={setLD('butchering')} /> : <span className="text-gray-300 text-xs pl-1">—</span>}
              </div>

              {/* AI Agent */}
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">AI Agent Named Users</label>
                  <input type="number" min={0} className={fc('aiAgentUsers')} value={deal.aiAgentUsers} onChange={setD('aiAgentUsers')} />
                </div>
                <div />
                {hasAI ? <DiscountInput value={lineDiscounts.ai} onChange={setLD('ai')} /> : <span className="text-gray-300 text-xs pl-1">—</span>}
              </div>
            </div>
          </Section>

          {/* Overall Discount */}
          <Section title="Discount">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Overall Deal Discount (%)</label>
              <DiscountInput value={deal.discount} onChange={(v) => setDeal((p) => ({ ...p, discount: v }))} placeholder="0" />
              <p className="text-xs text-gray-400 mt-1.5">Applied after per-line discounts, before quarterly premium (+6%).</p>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <textarea
              className={`${fc('notes')} h-20 resize-none`}
              placeholder="Optional notes…"
              value={deal.notes}
              onChange={setD('notes')}
            />
          </Section>

          {/* Foodics Invoice Number (Foodics deals only) */}
          {deal.posSystem === 'Foodics' && (
            <Section title="Foodics Invoice">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Foodics Invoice # <span className="text-gray-400 font-normal">(optional — can be added later)</span>
                </label>
                <input
                  className={fc('foodicsInvoiceNumber')}
                  value={deal.foodicsInvoiceNumber}
                  onChange={setD('foodicsInvoiceNumber')}
                  placeholder="e.g. INV-2025-00123"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Saved on the first invoice. Additional invoices can be updated from the Invoicing page.
                </p>
              </div>
            </Section>
          )}

          <button
            onClick={handleReview}
            className="w-full bg-emerald-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Review & Close Deal →
          </button>
        </div>

        {/* ── Right: Live Preview ───────────────────────── */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm sticky top-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Live Preview</p>

            {!summary ? (
              <p className="text-sm text-gray-400">Select country, channel, and package to see pricing.</p>
            ) : (
              <div className="space-y-3">
                {/* Per-component annual values */}
                {summary.invGross > 0 && (
                  <PreviewRow
                    label={`Normal Branches${Number(lineDiscounts.inventory) > 0 ? ` −${lineDiscounts.inventory}%` : ''}`}
                    value={fmt(summary.invNet, currency)}
                  />
                )}
                {summary.ckGross > 0 && (
                  <PreviewRow
                    label={`Central Kitchens${Number(lineDiscounts.ck) > 0 ? ` −${lineDiscounts.ck}%` : ''}`}
                    value={fmt(summary.ckNet, currency)}
                  />
                )}
                {summary.wGross > 0 && (
                  <PreviewRow
                    label={`Warehouses${Number(lineDiscounts.warehouse) > 0 ? ` −${lineDiscounts.warehouse}%` : ''}`}
                    value={fmt(summary.wNet, currency)}
                  />
                )}
                {summary.accMainGross > 0 && (
                  <PreviewRow
                    label={`Acct. Main${Number(lineDiscounts.accMain) > 0 ? ` −${lineDiscounts.accMain}%` : ''}`}
                    value={fmt(summary.accMainNet, currency)}
                  />
                )}
                {summary.accExtraGross > 0 && (
                  <PreviewRow
                    label={`Acct. Extra${Number(lineDiscounts.accExtra) > 0 ? ` −${lineDiscounts.accExtra}%` : ''}`}
                    value={fmt(summary.accExtraNet, currency)}
                  />
                )}
                {summary.butchGross > 0 && (
                  <PreviewRow
                    label={`Butchering${Number(lineDiscounts.butchering) > 0 ? ` −${lineDiscounts.butchering}%` : ''}`}
                    value={fmt(summary.butchNet, currency)}
                  />
                )}
                {summary.aiGross > 0 && (
                  <PreviewRow
                    label={`AI Agent${Number(lineDiscounts.ai) > 0 ? ` −${lineDiscounts.ai}%` : ''}`}
                    value={fmt(summary.aiNet, currency)}
                  />
                )}

                {/* Aggregates */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <PreviewRow label="Base Annual" value={fmt(summary.baseAnnual, currency)} />
                  {summary.discountAmt > 0 && (
                    <PreviewRow label={`Overall Discount (−${deal.discount}%)`} value={`−${fmt(summary.discountAmt, currency)}`} highlight />
                  )}
                  <PreviewRow label="Discounted Annual" value={fmt(summary.discountedAnnual, currency)} bold />
                  {deal.paymentType === 'Quarterly' && (
                    <PreviewRow label="Quarterly Premium (+6%)" value={`+${fmt(summary.effectiveAnnual - summary.discountedAnnual, currency)}`} />
                  )}
                  <PreviewRow label="Effective Annual" value={fmt(summary.effectiveAnnual, currency)} bold />
                </div>

                {/* MRR */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <PreviewRow label="MRR (excl. VAT)" value={fmt(summary.totalMRR, currency)} bold />
                  <PreviewRow label={`VAT (${(vatRate * 100).toFixed(0)}%)`} value={fmt(summary.totalMRR * vatRate, currency)} />
                  <PreviewRow label="MRR (incl. VAT)" value={fmt(summary.totalMRRInclVAT, currency)} />
                </div>

                {/* Contract value */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <PreviewRow label="Contract Months" value={`${summary.contractMonths} months`} />
                  <PreviewRow label="Contract Value (excl.)" value={fmt(summary.contractValue, currency)} bold />
                  <PreviewRow label="Contract Value (incl.)" value={fmt(summary.contractValueInclVAT, currency)} bold />
                </div>

                {deal.paymentType === 'Quarterly' && (
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <PreviewRow label="Per Invoice (excl.)" value={fmt(summary.quarterlyBilling, currency)} />
                    <PreviewRow label="Per Invoice (incl.)" value={fmt(summary.quarterlyBillingInclVAT, currency)} />
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3 text-xs text-gray-500">
                  {invoiceCount} invoice{invoiceCount > 1 ? 's' : ''} will be generated
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ────────────────────────────────── */}
      <Modal isOpen={modal === 'confirm'} onClose={() => setModal(null)} title="Confirm & Close Deal">
        {summary && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5 text-sm">
              <p><span className="text-gray-500">Account:</span> <span className="font-semibold">{account.accountName}</span></p>
              <p><span className="text-gray-500">Country:</span> {selectedCountry?.name || deal.countryCode}</p>
              <p><span className="text-gray-500">Channel · Package:</span> {deal.salesChannel} · {deal.package}</p>
              <p><span className="text-gray-500">Payment:</span> {deal.paymentType}{deal.paymentType === 'Special' ? ` (${deal.contractYears} yr)` : ''}</p>
              {summary.discountAmt > 0 && (
                <p><span className="text-gray-500">Discount:</span> <span className="text-indigo-600 font-medium">−{deal.discount}% overall</span></p>
              )}
              <p><span className="text-gray-500">MRR (excl. VAT):</span> <span className="font-mono font-semibold">{fmt(summary.totalMRR, currency)}</span></p>
              <p><span className="text-gray-500">Contract Value (incl. VAT):</span> <span className="font-mono font-semibold">{fmt(summary.contractValueInclVAT, currency)}</span></p>
              <p><span className="text-gray-500">Invoices:</span> <span className="font-semibold">{invoiceCount}</span></p>
            </div>
            <p className="text-sm text-gray-600">
              {lead.opportunityType === 'Expansion' || lead.opportunityType === 'Renewal'
                ? <>This will <strong>record the deal</strong> against the existing account and <strong>generate {invoiceCount} invoice{invoiceCount > 1 ? 's' : ''}</strong>. The opportunity will be marked as <strong>Closed Won</strong>.</>
                : <>This will <strong>create the CRM account</strong>, <strong>record the deal</strong>, and <strong>generate {invoiceCount} invoice{invoiceCount > 1 ? 's' : ''}</strong> — all in one step. The lead will be marked as <strong>Closed Won</strong>.</>
              }
            </p>
            {closeMutation.error && (
              <p className="text-sm text-red-500">{closeMutation.error.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={closeMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {closeMutation.isPending ? 'Creating…'
                  : (lead.opportunityType === 'Expansion' || lead.opportunityType === 'Renewal')
                    ? 'Confirm & Record Deal'
                    : 'Confirm & Create Account'}
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
