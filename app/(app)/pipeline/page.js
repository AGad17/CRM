'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { calcDealSummary } from '@/lib/invoicingCalc'
import { MentionTextarea } from '@/components/ui/MentionTextarea'
import { RenderedNote } from '@/components/ui/RenderedNote'

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

// Approximate exchange rates → USD (pegged currencies are exact; EGP is approximate)
const FX_TO_USD = { EGP: 0.020, SAR: 0.2667, AED: 0.2723, BHD: 2.6525, JOD: 1.4104, USD: 1 }

const OPP_TYPES = [
  { key: 'New',       label: 'New',       desc: 'Brand new account — no prior relationship', icon: '✨' },
  { key: 'Expansion', label: 'Expansion', desc: 'Existing account adding more branches or modules', icon: '📈' },
  { key: 'Renewal',   label: 'Renewal',   desc: 'Existing account renewing their current contract', icon: '🔄' },
]

const LOST_REASON_CATEGORIES = [
  { key: 'Price',        label: 'Price — Too expensive' },
  { key: 'Timing',       label: 'Timing — Not the right time' },
  { key: 'Competitor',   label: 'Competitor — Chose another vendor' },
  { key: 'NoBudget',     label: 'No Budget' },
  { key: 'Unresponsive', label: 'Unresponsive — Went dark' },
  { key: 'WrongFit',     label: 'Wrong Fit — Not a good match' },
  { key: 'Other',        label: 'Other' },
]

const ACTIVITY_TYPES = [
  { key: 'Call',         label: '📞 Call' },
  { key: 'Email',        label: '✉️ Email' },
  { key: 'Meeting',      label: '🤝 Meeting' },
  { key: 'Demo',         label: '🖥 Demo' },
  { key: 'ProposalSent', label: '📄 Proposal Sent' },
  { key: 'Other',        label: '📝 Other' },
]

const ADDON_MODULES = [
  { key: 'CentralKitchen',      label: 'Central Kitchen',       unitLabel: 'kitchens' },
  { key: 'Warehouse',           label: 'Warehouse',             unitLabel: 'warehouses' },
  { key: 'AccountingMain',      label: 'Accounting',            unitLabel: 'module' },
  { key: 'AccountingExtra',     label: 'Accounting Extra Branches', unitLabel: 'branches' },
  { key: 'Butchering',          label: 'Butchering',            unitLabel: 'module' },
  { key: 'AIAgent',             label: 'AI Agent',              unitLabel: 'users' },
]

const ACTIVITY_ACTION_LABELS = {
  stage_changed:   (m) => `Stage: ${m.from} → ${m.to}${m.lostReasonCategory ? ` (${m.lostReasonCategory})` : ''}`,
  lead_edited:     (m) => `Edited: ${(m.changes || []).map(c => c.field).join(', ')}`,
  activity_logged: (m) => `${m.type || 'Activity'} logged${m.outcome ? ` — ${m.outcome}` : ''}`,
  lead_archived:   (m) => `Archived: ${m.reason || ''}`,
  created:         ()  => 'Lead created',
}

const OPP_COLORS = {
  New:       'bg-indigo-100 text-indigo-700',
  Expansion: 'bg-emerald-100 text-emerald-700',
  Renewal:   'bg-amber-100 text-amber-700',
}

const EMPTY_FORM = {
  companyName: '', contactName: '', contactEmail: '', contactPhone: '',
  channel: '', countryCode: '', estimatedValue: '',
  opportunityDate: new Date().toISOString().slice(0, 10),
  expectedCloseDate: '', nextActionDate: '', notes: '', ownerId: '',
  lineItems: [],
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

function toUSD(value, countryCode) {
  if (!value) return 0
  const cur  = COUNTRY_CURRENCY[countryCode]
  const rate = FX_TO_USD[cur] ?? 1
  return Number(value) * rate
}

function fmtUSD(v) {
  if (!v) return null
  return `$${Math.round(v).toLocaleString('en-US')}`
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
  if (daysSinceUpdate >= 14) return 'stale'
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

// ─── Line-Item Builder ────────────────────────────────────────────────────────

function LineItemBuilder({ items = [], onChange, pricing, serviceItems = [], countryCode, channel }) {
  const [showPicker, setShowPicker] = useState(false)
  const [pickerTab, setPickerTab]   = useState('package')
  const [pkgForm,   setPkgForm]     = useState({ package: '', qty: '' })
  const [addonForm, setAddonForm]   = useState({ key: '', qty: '', unitPrice: '' })
  const [svcForm,   setSvcForm]     = useState({ serviceItemId: '', qty: 1, unitPrice: '' })

  const currency = COUNTRY_CURRENCY[countryCode] || ''

  // Auto-calculate package price
  const pkgEstimate = useMemo(() => {
    if (!pricing || !countryCode || !channel || !pkgForm.package || !pkgForm.qty) return null
    const country = (pricing.countries || []).find((c) => c.code === countryCode)
    if (!country) return null
    try {
      return calcDealSummary({
        normalBranches: Number(pkgForm.qty) || 0, centralKitchens: 0, warehouses: 0,
        hasAccounting: false, extraAccountingBranches: 0, hasButchering: false, aiAgentUsers: 0,
        countryCode, salesChannel: channel, package: pkgForm.package,
        paymentType: 'Annual', contractYears: 1,
        vatRate: Number(country.vatRate || 0), discount: 0, lineDiscounts: {},
        inventoryPricing: pricing.inventoryPricing || [], addOnPricing: pricing.addOnPricing || [],
      })
    } catch { return null }
  }, [pricing, countryCode, channel, pkgForm.package, pkgForm.qty])

  function addItem(item) {
    onChange([...items, { ...item, _key: `${Date.now()}-${Math.random()}` }])
    setShowPicker(false)
  }
  function removeItem(key) { onChange(items.filter((i) => i._key !== key)) }
  function updateItem(key, field, val) {
    onChange(items.map((i) => {
      if (i._key !== key) return i
      const u = { ...i, [field]: val }
      u.subtotal = Number(u.qty || 0) * Number(u.unitPrice || 0)
      return u
    }))
  }

  const recurringTotal = items.filter((i) => !i.isOneTime).reduce((s, i) => s + (Number(i.qty || 0) * Number(i.unitPrice || 0)), 0)
  const onetimeTotal   = items.filter((i) =>  i.isOneTime).reduce((s, i) => s + (Number(i.qty || 0) * Number(i.unitPrice || 0)), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Products / Line Items</label>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
        >
          <span className="text-base leading-none">+</span> Add Line Item
        </button>
      </div>

      {/* Picker panel */}
      {showPicker && (
        <div className="border border-indigo-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Category tabs */}
          <div className="flex border-b border-gray-100">
            {[{ key: 'package', label: '📦 Package' }, { key: 'addon', label: '🔧 Add-on' }, { key: 'service', label: '💼 Service' }].map((t) => (
              <button key={t.key} type="button" onClick={() => setPickerTab(t.key)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${pickerTab === t.key ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">

            {/* ── Package tab ── */}
            {pickerTab === 'package' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Package *</label>
                    <select value={pkgForm.package} onChange={(e) => setPkgForm((p) => ({ ...p, package: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                      <option value="">Select…</option>
                      {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Branches *</label>
                    <input type="number" min="1" value={pkgForm.qty}
                      onChange={(e) => setPkgForm((p) => ({ ...p, qty: e.target.value }))}
                      placeholder="e.g. 5"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  </div>
                </div>
                {(!countryCode || !channel) && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">⚠ Set country and channel above to auto-calculate price</p>
                )}
                {pkgEstimate && Number(pkgForm.qty) > 0 && (
                  <div className="bg-indigo-50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-indigo-700">{pkgForm.package} · {pkgForm.qty} branches · Annual</p>
                      <p className="text-xs text-indigo-400">{currency} {Math.round(pkgEstimate.effectiveAnnual / Number(pkgForm.qty)).toLocaleString('en-US')} / branch / yr</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-700">{currency} {Math.round(pkgEstimate.effectiveAnnual).toLocaleString('en-US')}</p>
                  </div>
                )}
                <button type="button"
                  disabled={!pkgForm.package || !pkgForm.qty || !pkgEstimate}
                  onClick={() => {
                    const qty    = Number(pkgForm.qty)
                    const annual = Math.round(pkgEstimate.effectiveAnnual)
                    addItem({ category: 'package', productKey: pkgForm.package, serviceItemId: null,
                      name: `${pkgForm.package} (${qty} branches)`, qty,
                      unitPrice: Math.round(annual / qty), pricingType: 'Fixed', isOneTime: false })
                    setPkgForm({ package: '', qty: '' })
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Add Package
                </button>
              </div>
            )}

            {/* ── Add-on tab ── */}
            {pickerTab === 'addon' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Module *</label>
                    <select value={addonForm.key} onChange={(e) => {
                      const mod = ADDON_MODULES.find((m) => m.key === e.target.value)
                      setAddonForm((p) => ({ ...p, key: e.target.value, qty: mod?.unitLabel === 'module' ? '1' : p.qty }))
                    }}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                      <option value="">Select…</option>
                      {ADDON_MODULES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Qty {addonForm.key && `(${ADDON_MODULES.find((m) => m.key === addonForm.key)?.unitLabel})`}
                    </label>
                    <input type="number" min="1" value={addonForm.qty}
                      onChange={(e) => setAddonForm((p) => ({ ...p, qty: e.target.value }))}
                      placeholder="1"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Annual Price {currency ? `(${currency})` : ''}</label>
                  <input type="number" min="0" value={addonForm.unitPrice}
                    onChange={(e) => setAddonForm((p) => ({ ...p, unitPrice: e.target.value }))}
                    placeholder="Enter agreed annual price…"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                </div>
                <button type="button"
                  disabled={!addonForm.key || !addonForm.qty || addonForm.unitPrice === ''}
                  onClick={() => {
                    const mod = ADDON_MODULES.find((m) => m.key === addonForm.key)
                    addItem({ category: 'addon', productKey: addonForm.key, serviceItemId: null,
                      name: `${mod?.label} (${addonForm.qty} ${mod?.unitLabel})`,
                      qty: Number(addonForm.qty), unitPrice: Number(addonForm.unitPrice),
                      pricingType: 'Custom', isOneTime: false })
                    setAddonForm({ key: '', qty: '', unitPrice: '' })
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Add Add-on
                </button>
              </div>
            )}

            {/* ── Service tab ── */}
            {pickerTab === 'service' && (
              <div className="space-y-3">
                {serviceItems.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">
                    No services configured.{' '}
                    <a href="/settings/pricing" className="underline text-indigo-500">Add services in Settings → Pricing.</a>
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Service *</label>
                      <select value={svcForm.serviceItemId} onChange={(e) => {
                        const svc = serviceItems.find((s) => String(s.id) === e.target.value)
                        setSvcForm((p) => ({ ...p, serviceItemId: e.target.value, unitPrice: svc ? String(Number(svc.defaultPrice)) : '' }))
                      }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                        <option value="">Select…</option>
                        {serviceItems.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} {s.pricingType === 'Fixed' ? '🔒' : '✏️'}</option>
                        ))}
                      </select>
                      {svcForm.serviceItemId && (() => {
                        const svc = serviceItems.find((s) => String(s.id) === svcForm.serviceItemId)
                        if (!svc) return null
                        return (
                          <p className="text-xs mt-1 text-gray-400">
                            {svc.pricingType === 'Fixed' ? '🔒 Fixed price — always billed at default rate' : '✏️ Custom per deal — enter the agreed price below'}
                            {svc.description ? ` · ${svc.description}` : ''}
                          </p>
                        )
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Qty</label>
                        <input type="number" min="1" value={svcForm.qty}
                          onChange={(e) => setSvcForm((p) => ({ ...p, qty: Number(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Price {currency ? `(${currency})` : ''}
                          {serviceItems.find((s) => String(s.id) === svcForm.serviceItemId)?.pricingType === 'Fixed' && (
                            <span className="ml-1 text-[10px] text-gray-300 font-normal">locked</span>
                          )}
                        </label>
                        <input type="number" min="0"
                          disabled={serviceItems.find((s) => String(s.id) === svcForm.serviceItemId)?.pricingType === 'Fixed'}
                          value={svcForm.unitPrice}
                          onChange={(e) => setSvcForm((p) => ({ ...p, unitPrice: e.target.value }))}
                          placeholder="Agreed price…"
                          className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${serviceItems.find((s) => String(s.id) === svcForm.serviceItemId)?.pricingType === 'Fixed' ? 'bg-gray-100 border-gray-100 text-gray-500' : 'border-gray-200'}`}
                        />
                      </div>
                    </div>
                    <button type="button"
                      disabled={!svcForm.serviceItemId || svcForm.unitPrice === ''}
                      onClick={() => {
                        const svc = serviceItems.find((s) => String(s.id) === svcForm.serviceItemId)
                        addItem({ category: 'service', productKey: null, serviceItemId: svc.id,
                          name: svc.name, qty: Number(svcForm.qty || 1),
                          unitPrice: Number(svcForm.unitPrice),
                          pricingType: svc.pricingType, isOneTime: true })
                        setSvcForm({ serviceItemId: '', qty: 1, unitPrice: '' })
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      Add Service
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="px-4 pb-3 flex justify-end border-t border-gray-50 pt-2">
            <button type="button" onClick={() => setShowPicker(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">Close</button>
          </div>
        </div>
      )}

      {/* Line items list */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">
            <div className="col-span-5">Product</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-2 text-right">Subtotal</div>
            <div className="col-span-1" />
          </div>
          {items.map((item) => (
            <div key={item._key} className="grid grid-cols-12 gap-1 items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              <div className="col-span-5 min-w-0">
                <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{item.name}</p>
                <span className={`text-[10px] font-medium ${item.isOneTime ? 'text-amber-600' : 'text-indigo-600'}`}>
                  {item.isOneTime ? '⚡ One-time' : '🔄 Annual'}
                </span>
              </div>
              <div className="col-span-2">
                <input type="number" min="1" value={item.qty}
                  onChange={(e) => updateItem(item._key, 'qty', Number(e.target.value))}
                  className="w-full text-right text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              </div>
              <div className="col-span-2">
                <input type="number" min="0" value={item.unitPrice}
                  disabled={item.pricingType === 'Fixed' && item.category !== 'package'}
                  onChange={(e) => updateItem(item._key, 'unitPrice', Number(e.target.value))}
                  className={`w-full text-right text-xs border rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${item.pricingType === 'Fixed' && item.category !== 'package' ? 'bg-gray-100 border-gray-100 text-gray-500' : 'bg-white border-gray-200'}`}
                />
              </div>
              <div className="col-span-2 text-right">
                <span className="text-xs font-semibold text-gray-700">
                  {(Number(item.qty || 0) * Number(item.unitPrice || 0)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <button type="button" onClick={() => removeItem(item._key)} className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none">✕</button>
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="border-t border-gray-100 pt-2 space-y-1 text-right pr-1">
            {recurringTotal > 0 && (
              <p className="text-xs text-gray-500">🔄 Annual recurring: <span className="font-semibold text-gray-700">{currency} {recurringTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></p>
            )}
            {onetimeTotal > 0 && (
              <p className="text-xs text-gray-500">⚡ One-time fees: <span className="font-semibold text-gray-700">{currency} {onetimeTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></p>
            )}
            <p className="text-xs font-bold text-gray-900">
              Grand Total: {currency} {(recurringTotal + onetimeTotal).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {items.length === 0 && !showPicker && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-400">No products added yet</p>
          <p className="text-xs text-gray-300 mt-0.5">Click &quot;+ Add Line Item&quot; to build the deal</p>
        </div>
      )}
    </div>
  )
}

// ─── Lead Form ───────────────────────────────────────────────────────────────

function LeadForm({ form, setForm, errors, agents, pricing, serviceItems = [], onDupCheck, dupWarning = [] }) {
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const cls = (k) => `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[k] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">

        {/* Company */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company Name *</label>
          <input
            className={cls('companyName')}
            value={form.companyName}
            onChange={set('companyName')}
            onBlur={() => onDupCheck && form.companyName.trim().length > 1 && onDupCheck(form.companyName.trim())}
            placeholder="e.g. Al Baik Restaurant Group"
          />
          {errors.companyName && <p className="text-xs text-red-500 mt-0.5">{errors.companyName}</p>}
          {dupWarning.length > 0 && (
            <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Similar leads already exist:</p>
              {dupWarning.map((d) => (
                <p key={d.id} className="text-xs text-amber-600">
                  #{d.id} {d.companyName} — <span className="font-medium">{d.stage}</span> · {d.owner?.name || 'Unassigned'}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Contact */}
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

        {/* Channel + Country */}
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

        {/* Dates */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Opportunity Date *</label>
          <input className={cls('opportunityDate')} type="date" max={new Date().toISOString().slice(0, 10)} value={form.opportunityDate} onChange={set('opportunityDate')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected Close Date</label>
          <input className={cls('expectedCloseDate')} type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Next Action Date</label>
          <input className={cls('nextActionDate')} type="date" value={form.nextActionDate || ''} onChange={set('nextActionDate')} />
        </div>

        {/* Owner */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Owner *</label>
          <select className={cls('ownerId')} value={form.ownerId} onChange={set('ownerId')}>
            <option value="">Assign to…</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {errors.ownerId && <p className="text-xs text-red-500 mt-0.5">{errors.ownerId}</p>}
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
          <textarea className={cls('notes')} rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional notes…" />
        </div>
      </div>

      {/* ── Line Items ── */}
      <div className="border-t border-gray-100 pt-4">
        <LineItemBuilder
          items={form.lineItems || []}
          onChange={(items) => setForm((p) => ({ ...p, lineItems: items }))}
          pricing={pricing}
          serviceItems={serviceItems}
          countryCode={form.countryCode}
          channel={form.channel}
        />
      </div>

      {/* Manual estimated value (only when no line items) */}
      {(!form.lineItems || form.lineItems.length === 0) && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Est. Deal Value {COUNTRY_CURRENCY[form.countryCode] ? `(${COUNTRY_CURRENCY[form.countryCode]})` : ''}
            <span className="text-gray-300 font-normal ml-1 normal-case">· or add line items above to auto-calculate</span>
          </label>
          <input className={cls('estimatedValue')} type="number" min="0" value={form.estimatedValue} onChange={set('estimatedValue')} placeholder="0" />
        </div>
      )}
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
        <div>
          <span className="font-semibold text-gray-800 text-sm">{val || '—'}</span>
          {lead.estimatedValue && COUNTRY_CURRENCY[lead.countryCode] !== 'USD' && (
            <p className="text-[10px] text-gray-400 leading-tight">{fmtUSD(toUSD(lead.estimatedValue, lead.countryCode))} USD</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>{daysAgo(lead.opportunityDate)}</span>
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials(lead.owner?.name)}
          </span>
        </div>
      </div>

      {/* Account link */}
      {lead.account ? (
        <div className="flex items-center justify-between gap-2">
          <a href={`/accounts/${lead.account.id}`}
             onClick={(e) => e.stopPropagation()}
             className="text-xs text-indigo-600 hover:underline truncate">
            🏢 {lead.account.name}
          </a>
          {lead.stage === 'ClosedWon' && (
            <a href={`/onboarding?account=${lead.account.id}`}
               onClick={(e) => e.stopPropagation()}
               className="flex-shrink-0 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100 transition-colors font-medium">
              + Onboarding
            </a>
          )}
        </div>
      ) : (lead.stage === 'ClosedWon') ? (
        <span className="text-xs text-amber-500 italic font-medium">⚠ No account linked</span>
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
  const router       = useRouter()
  const searchParams = useSearchParams()
  const qc           = useQueryClient()
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
  // null | 'create' | { edit: lead } | { confirmLoss: lead } | { confirmChurn: lead } | { closedWonBlocked: lead, missing: string[] } | 'migrate' | { archive: lead }
  const [modal, setModal] = useState(null)
  const [lostReason, setLostReason] = useState('')
  const [lostReasonCategory, setLostReasonCategory] = useState('')
  const [archiveReason, setArchiveReason] = useState('')
  const [dupWarning, setDupWarning] = useState([])      // duplicate company matches
  const [activityForm, setActivityForm] = useState({ type: '', notes: '', outcome: '', loggedAt: new Date().toISOString().slice(0, 10) })
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [migrateResult, setMigrateResult] = useState(null)

  // Edit modal tabs: 'details' | 'comments'
  const [modalTab, setModalTab]       = useState('details')
  const [commentText, setCommentText] = useState('')
  // New Opportunity flow
  const [oppType, setOppType] = useState(null)           // null | 'New' | 'Expansion' | 'Renewal'
  const [accountSearch, setAccountSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState(null)

  // ── Data ──
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: () => fetch('/api/pipeline').then((r) => r.json()),
  })

  // Auto-open edit modal + comments tab from notification deep-link (?lead=ID&comment=ID)
  useEffect(() => {
    const leadId    = searchParams.get('lead')
    const commentId = searchParams.get('comment')
    if (!leadId || !leads.length) return
    const lead = leads.find((l) => String(l.id) === String(leadId))
    if (!lead) return
    setModal({ edit: lead })
    setModalTab('comments')
    // After comments render, scroll to the specific comment
    if (commentId) {
      setTimeout(() => {
        const el = document.getElementById(`comment-${commentId}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 600)
    }
  }, [leads, searchParams])

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

  const { data: serviceItems = [] } = useQuery({
    queryKey: ['service-items'],
    queryFn: () => fetch('/api/service-items').then((r) => r.json()),
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
    onSuccess: () => { invalidate(); setModal(null); setDupWarning([]) },
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

  const archiveM = useMutation({
    mutationFn: ({ id, reason }) => fetch(`/api/pipeline/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', reason }),
    }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setModal(null); setArchiveReason('') },
  })

  const activityM = useMutation({
    mutationFn: ({ leadId, data }) => fetch(`/api/pipeline/${leadId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', editLeadId] })
      qc.invalidateQueries({ queryKey: ['lead-activity', editLeadId] })
      setActivityForm({ type: '', notes: '', outcome: '', loggedAt: new Date().toISOString().slice(0, 10) })
    },
  })

  const migrateM = useMutation({
    mutationFn: () => fetch('/api/pipeline/migrate', { method: 'POST' }).then((r) => r.json()),
    onSuccess: (data) => { invalidate(); setMigrateResult(data) },
  })

  // ── Lead Comments ──
  const editLeadId = modal?.edit?.id ?? null

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['lead-comments', editLeadId],
    queryFn:  () => fetch(`/api/pipeline/${editLeadId}/comments`).then((r) => r.json()),
    enabled:  !!editLeadId && modalTab === 'comments',
  })
  const { data: activityData } = useQuery({
    queryKey: ['lead-activity', editLeadId],
    queryFn:  () => fetch(`/api/pipeline/${editLeadId}`).then((r) => r.json()),
    enabled:  !!editLeadId && (modalTab === 'comments' || modalTab === 'activities'),
  })
  const { data: leadActivities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['lead-activities', editLeadId],
    queryFn:  () => fetch(`/api/pipeline/${editLeadId}/activities`).then((r) => r.json()),
    enabled:  !!editLeadId && modalTab === 'activities',
  })

  const commentM = useMutation({
    mutationFn: ({ leadId, content }) =>
      fetch(`/api/pipeline/${leadId}/comments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-comments', editLeadId] })
      setCommentText('')
    },
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
    setDupWarning([])
    setModal('create')
  }

  function openEdit(lead) {
    // Restore _key for each stored line item so React can track them
    const storedItems = Array.isArray(lead.lineItems) && lead.lineItems.length > 0
      ? lead.lineItems.map((item, idx) => ({ ...item, _key: `${idx}-${Date.now()}` }))
      : []
    setFormData({
      companyName:       lead.companyName,
      contactName:       lead.contactName      || '',
      contactEmail:      lead.contactEmail     || '',
      contactPhone:      lead.contactPhone     || '',
      channel:           lead.channel,
      countryCode:       lead.countryCode      || '',
      estimatedValue:    storedItems.length === 0 && lead.estimatedValue != null ? String(lead.estimatedValue) : '',
      opportunityDate:   lead.opportunityDate   ? new Date(lead.opportunityDate).toISOString().slice(0, 10)   : new Date().toISOString().slice(0, 10),
      expectedCloseDate: lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().slice(0, 10) : '',
      nextActionDate:    lead.nextActionDate    ? new Date(lead.nextActionDate).toISOString().slice(0, 10)    : '',
      notes:             lead.notes            || '',
      ownerId:           lead.ownerId,
      lineItems:         storedItems,
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

    // Strip internal _key before sending to API
    const cleanLineItems = (formData.lineItems || []).map(({ _key, ...rest }) => ({
      ...rest,
      subtotal: Number(rest.qty || 0) * Number(rest.unitPrice || 0),
    }))

    // Derive estimatedValue from line items total; fall back to manual field
    const lineItemTotal   = cleanLineItems.reduce((s, i) => s + (i.subtotal || 0), 0)
    const estimatedValue  = lineItemTotal > 0 ? lineItemTotal : (Number(formData.estimatedValue) || null)

    // Derive packageInterest + numberOfBranches from package line item (backward compat)
    const pkgItem = cleanLineItems.find((i) => i.category === 'package')

    const payload = {
      ...formData,
      lineItems:        cleanLineItems.length > 0 ? cleanLineItems : null,
      estimatedValue,
      packageInterest:  pkgItem?.productKey  || null,
      numberOfBranches: pkgItem ? Number(pkgItem.qty) || null : null,
      opportunityType:  oppType || 'New',
      nextActionDate:   formData.nextActionDate || '',
      ...(isExpRen && selectedAccount && {
        companyName: selectedAccount.name,
        countryCode: selectedAccount.country?.code || formData.countryCode,
        accountId:   selectedAccount.id,
      }),
    }
    if (modal === 'create') {
      createM.mutate(payload)
    } else if (modal?.edit) {
      updateM.mutate({ id: modal.edit.id, data: payload })
    }
  }

  function handleStageAction(lead, action) {
    if (action === 'ClosedWon') {
      // Gate: required lead fields must be filled before opening the close deal page
      const missing = []
      // Derive package + branches from either new lineItems or legacy fields
      const lineItems   = Array.isArray(lead.lineItems) ? lead.lineItems : []
      const pkgLineItem = lineItems.find((i) => i.category === 'package')
      const hasPkg      = !!lead.packageInterest || !!pkgLineItem
      const hasBranches = (lead.numberOfBranches && lead.numberOfBranches >= 1) || (pkgLineItem && pkgLineItem.qty >= 1)
      if (!lead.contactName?.trim())                               missing.push('Contact Name')
      if (!lead.contactEmail?.trim() && !lead.contactPhone?.trim()) missing.push('Contact Email or Phone')
      if (!lead.countryCode)                                       missing.push('Country')
      if (!hasPkg)                                                 missing.push('Package Interest (add a Package line item)')
      if (!hasBranches)                                            missing.push('Number of Branches')
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
    setLostReasonCategory('')
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
          {isAdmin && <button onClick={() => { setArchiveReason(''); setModal({ archive: r }) }} className="text-xs text-gray-400 hover:text-red-500 font-medium">Archive</button>}
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
              const col      = byStage(s.key)
              const colUSD   = col.reduce((sum, l) => sum + toUSD(l.estimatedValue, l.countryCode), 0)
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
                    {col.length > 0 && (
                      <p className="text-xs font-semibold text-gray-600 mt-0.5 pl-3.5">
                        {colUSD > 0 ? fmtUSD(colUSD) : '—'} <span className="font-normal text-gray-400">total</span>
                      </p>
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
                <LeadForm
                  form={formData} setForm={setFormData} errors={formErrors}
                  agents={agents} pricing={pricing} serviceItems={serviceItems}
                  dupWarning={dupWarning}
                  onDupCheck={async (name) => {
                    const res = await fetch(`/api/pipeline?duplicateCheck=${encodeURIComponent(name)}`).then((r) => r.json())
                    setDupWarning(res || [])
                  }}
                />
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
      <Modal isOpen={!!modal?.edit} onClose={() => { setModal(null); setModalTab('details') }} title="Edit Opportunity">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 -mt-1 mb-4">
          {[{ key: 'details', label: '📋 Details' }, { key: 'activities', label: '📞 Activities' }, { key: 'comments', label: '💬 Comments' }].map((t) => (
            <button
              key={t.key}
              onClick={() => setModalTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                modalTab === t.key
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Details tab */}
        {modalTab === 'details' && (
          <div className="space-y-5">
            <LeadForm form={formData} setForm={setFormData} errors={formErrors} agents={agents} pricing={pricing} serviceItems={serviceItems} />
            {updateM.data?.error && (
              <p className="text-sm text-red-500">{updateM.data.error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} disabled={updateM.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors">
                {updateM.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              {isAdmin && (
                <button onClick={() => { setArchiveReason(''); setModal({ archive: modal.edit }) }} className="px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-sm transition-colors">
                  Archive
                </button>
              )}
              <button onClick={() => { setModal(null); setModalTab('details') }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Activities tab */}
        {modalTab === 'activities' && (
          <div className="flex flex-col gap-4">
            {/* Log a new activity */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Log Activity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type *</label>
                  <select
                    value={activityForm.type}
                    onChange={(e) => setActivityForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">Select…</option>
                    {ACTIVITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date *</label>
                  <input type="date" value={activityForm.loggedAt}
                    onChange={(e) => setActivityForm((p) => ({ ...p, loggedAt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Outcome</label>
                  <input type="text" value={activityForm.outcome}
                    onChange={(e) => setActivityForm((p) => ({ ...p, outcome: e.target.value }))}
                    placeholder="e.g. Sent proposal, Booked demo…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input type="text" value={activityForm.notes}
                    onChange={(e) => setActivityForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Brief notes…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <button
                onClick={() => activityM.mutate({ leadId: editLeadId, data: activityForm })}
                disabled={!activityForm.type || !activityForm.loggedAt || activityM.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {activityM.isPending ? 'Logging…' : 'Log Activity'}
              </button>
            </div>

            {/* Activity history */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {activitiesLoading ? (
                <div className="animate-pulse h-16 bg-gray-100 rounded-xl" />
              ) : leadActivities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No activities logged yet.</p>
              ) : leadActivities.map((a) => {
                const typeInfo = ACTIVITY_TYPES.find(t => t.key === a.type)
                return (
                  <div key={a.id} className="flex gap-3 items-start bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                    <span className="text-base leading-none mt-0.5">{typeInfo?.label?.split(' ')[0] || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700">{typeInfo?.label?.split(' ').slice(1).join(' ') || a.type}</span>
                        {a.outcome && <span className="text-xs text-emerald-600 font-medium">→ {a.outcome}</span>}
                        <span className="text-xs text-gray-400 ml-auto">{new Date(a.loggedAt).toLocaleDateString('en-GB')}</span>
                      </div>
                      {a.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{a.notes}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">by {a.actor?.name || a.actor?.email}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Comments & Activity tab */}
        {modalTab === 'comments' && (
          <div className="flex flex-col gap-4">
            {/* Timeline */}
            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {commentsLoading ? (
                <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />
              ) : (() => {
                const comments = (commentsData?.comments ?? []).map((c) => ({ ...c, _type: 'comment' }))
                const logs     = (activityData?.activityLog ?? []).map((l) => ({ ...l, _type: 'log' }))
                const timeline = [...comments, ...logs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                if (!timeline.length) return (
                  <p className="text-sm text-gray-400 text-center py-6">No comments or activity yet.</p>
                )
                return timeline.map((item) => {
                  if (item._type === 'comment') return (
                    <div key={`c-${item.id}`} id={`comment-${item.id}`} className="flex gap-3 scroll-mt-4">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        {(item.author?.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700">{item.author?.name || item.author?.email}</span>
                          <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        <RenderedNote content={item.content} className="text-sm text-gray-700 leading-relaxed" />
                      </div>
                    </div>
                  )
                  // Activity log entry
                  const meta = item.meta || {}
                  const labelFn = ACTIVITY_ACTION_LABELS[item.action]
                  const desc = labelFn ? labelFn(meta) : item.action?.replace(/_/g, ' ')
                  return (
                    <div key={`l-${item.id}`} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs">⚡</div>
                      <div className="flex-1 py-1">
                        <span className="text-xs text-gray-500">
                          <span className="font-medium text-gray-600">{item.actorName || 'System'}</span>
                          {' '}{desc}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Comment input */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <MentionTextarea
                value={commentText}
                onChange={setCommentText}
                placeholder="Add a comment… use @ to mention a teammate"
                rows={3}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && commentText.trim()) {
                    e.preventDefault()
                    commentM.mutate({ leadId: editLeadId, content: commentText.trim() })
                  }
                }}
              />
              <div className="flex justify-end">
                <button
                  onClick={() => commentM.mutate({ leadId: editLeadId, content: commentText.trim() })}
                  disabled={!commentText.trim() || commentM.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {commentM.isPending ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Lost */}
      <Modal isOpen={!!modal?.confirmLoss} onClose={() => { setModal(null); setLostReasonCategory(''); setLostReason('') }} title="Mark as Closed Lost">
        {modal?.confirmLoss && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Why was <strong>{modal.confirmLoss.companyName}</strong> lost?</p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason *</label>
              <select
                value={lostReasonCategory}
                onChange={(e) => setLostReasonCategory(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 ${!lostReasonCategory ? 'border-gray-200' : 'border-gray-300'}`}
              >
                <option value="">Select a reason…</option>
                {LOST_REASON_CATEGORIES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Additional Notes <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea
                rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)}
                placeholder="Any additional context…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => confirmStage(modal.confirmLoss, 'ClosedLost', { lostReason, lostReasonCategory })}
                disabled={!lostReasonCategory || stageM.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {stageM.isPending ? 'Saving…' : 'Confirm Lost'}
              </button>
              <button onClick={() => { setModal(null); setLostReasonCategory(''); setLostReason('') }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Archive Lead */}
      <Modal isOpen={!!modal?.archive} onClose={() => { setModal(null); setArchiveReason('') }} title="Archive Lead">
        {modal?.archive && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Archive <strong>{modal.archive.companyName}</strong>? It will be hidden from the pipeline but its history will be preserved.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason *</label>
              <textarea
                rows={2} value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g. Duplicate entry, test lead…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => archiveM.mutate({ id: modal.archive.id, reason: archiveReason })}
                disabled={!archiveReason.trim() || archiveM.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {archiveM.isPending ? 'Archiving…' : 'Archive Lead'}
              </button>
              <button onClick={() => { setModal(null); setArchiveReason('') }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
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
