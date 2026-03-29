'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const PACKAGES = ['Essential', 'Operations', 'Enterprise']

const ADDON_MODULES = [
  { value: 'CentralKitchen',  label: 'Central Kitchen' },
  { value: 'Warehouse',       label: 'Warehouse' },
  { value: 'AccountingMain',  label: 'Acct. Main' },
  { value: 'AccountingExtra', label: 'Acct. Extra' },
  { value: 'Butchering',      label: 'Butchering' },
  { value: 'AIAgent',         label: 'AI Agent' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PricingInput({ value, onChange, disabled }) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-400 text-right"
      placeholder="—"
    />
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Services Section ─────────────────────────────────────────────────────────

const EMPTY_SVC = { name: '', description: '', defaultPrice: '', pricingType: 'Custom' }

function ServicesSection({ isAdmin }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_SVC)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)

  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 4000) }

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['service-items-all'],
    queryFn: () => fetch('/api/service-items?all=true').then(r => r.json()),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['service-items-all'] })

  async function apiFetch(url, opts) {
    const r = await fetch(url, opts)
    const json = await r.json()
    if (!r.ok) throw new Error(json?.error || `Request failed (${r.status})`)
    return json
  }

  const isEditing = editId !== null
  const saveM = useMutation({
    mutationFn: (data) => isEditing
      ? apiFetch(`/api/service-items/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      : apiFetch('/api/service-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); setForm(EMPTY_SVC); setEditId(null); flash(isEditing ? 'Service updated!' : 'Service added!') },
    onError: (e) => flash(`Error: ${e.message}`),
  })

  const toggleM = useMutation({
    mutationFn: ({ id, isActive }) => apiFetch(`/api/service-items/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...items.find(i => i.id === id), isActive }),
    }),
    onSuccess: () => { invalidate(); flash('Saved!') },
    onError: (e) => flash(`Error: ${e.message}`),
  })

  function startEdit(item) {
    setEditId(item.id)
    setForm({ name: item.name, description: item.description || '', defaultPrice: String(Number(item.defaultPrice)), pricingType: item.pricingType })
  }

  function cancelEdit() { setEditId(null); setForm(EMPTY_SVC) }

  if (isLoading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {msg && <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${msg.startsWith('Error') ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>{msg}</span>}
      </div>

      {/* Add / Edit form */}
      {isAdmin && (
        <Section title={editId ? 'Edit Service Item' : 'Add Service Item'} subtitle="One-time fee items available to add to any lead.">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="e.g. API Integration" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Pricing Type</label>
              <select value={form.pricingType} onChange={e => setForm(p => ({ ...p, pricingType: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="Fixed">Fixed — price is locked per catalog</option>
                <option value="Custom">Custom — rep enters agreed price per deal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {form.pricingType === 'Fixed' ? 'Price' : 'Default / Suggested Price'}
              </label>
              <input type="number" min="0" step="0.01" value={form.defaultPrice}
                onChange={e => setForm(p => ({ ...p, defaultPrice: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description <span className="text-gray-300">(optional)</span></label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Brief description…" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => saveM.mutate(form)} disabled={!form.name.trim() || saveM.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
              {saveM.isPending ? 'Saving…' : editId ? 'Update' : 'Add Service Item'}
            </button>
            {editId && <button onClick={cancelEdit} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">Cancel</button>}
          </div>
        </Section>
      )}

      {/* Items list */}
      <Section title="Service Catalog" subtitle={`${items.filter(i => i.isActive).length} active items`}>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No service items yet. Add one above.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className={`flex items-center gap-4 py-3 ${!item.isActive ? 'opacity-40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.pricingType === 'Fixed' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.pricingType}
                    </span>
                    {!item.isActive && <span className="text-xs text-gray-400 italic">inactive</span>}
                  </div>
                  {item.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>}
                </div>
                <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  {item.pricingType === 'Fixed' ? (
                    <span>{Number(item.defaultPrice).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                  ) : (
                    <span className="text-gray-400">Agreed per deal{Number(item.defaultPrice) > 0 ? ` (default: ${Number(item.defaultPrice).toLocaleString()})` : ''}</span>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(item)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                    <button onClick={() => toggleM.mutate({ id: item.id, isActive: !item.isActive })}
                      className={`text-xs font-medium ${item.isActive ? 'text-gray-400 hover:text-red-500' : 'text-emerald-600 hover:text-emerald-800'}`}>
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PricingConfigPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const isAdmin = ['CCO_ADMIN', 'REVENUE_MANAGER'].includes(session?.user?.role)

  const [pageTab, setPageTab] = useState('subscription') // 'subscription' | 'services'

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['invoicing-pricing'],
    queryFn: () => fetch('/api/invoicing/pricing').then((r) => r.json()),
    staleTime: 30_000,
  })

  const [activeCountry, setActiveCountry] = useState(null)
  const [inventoryEdits, setInventoryEdits] = useState({})
  const [addOnEdits, setAddOnEdits] = useState({})
  const [vatEdits, setVatEdits] = useState({})
  const [saveMsg, setSaveMsg] = useState(null)

  const saveInventory = useMutation({
    mutationFn: (rows) => fetch('/api/invoicing/pricing/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['invoicing-pricing']); showMsg('Inventory pricing saved!') },
  })

  const saveAddOn = useMutation({
    mutationFn: (rows) => fetch('/api/invoicing/pricing/addon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['invoicing-pricing']); showMsg('Add-on pricing saved!') },
  })

  const saveVAT = useMutation({
    mutationFn: ({ countryCode, vatRate }) => fetch('/api/invoicing/pricing/vat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode, vatRate }),
    }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['invoicing-pricing']); showMsg('VAT rate saved!') },
  })

  function showMsg(msg) {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />

  const countries = pricing?.countries || []
  const cc = activeCountry || countries[0]?.code
  const country = countries.find((c) => c.code === cc)

  // ── Inventory value helpers ──
  function getInvVal(salesChannel, pkg) {
    const key = `${cc}|${salesChannel}|${pkg}`
    if (inventoryEdits[key] !== undefined) return inventoryEdits[key]
    const row = pricing?.inventoryPricing?.find(
      (r) => r.countryCode === cc && r.salesChannel === salesChannel && r.package === pkg
    )
    return row ? Number(row.annualPrice) : ''
  }
  function setInvVal(salesChannel, pkg, val) {
    setInventoryEdits((prev) => ({ ...prev, [`${cc}|${salesChannel}|${pkg}`]: val }))
  }

  // ── Add-on value helpers ──
  function getAddOnVal(salesChannel, module) {
    const key = `${cc}|${salesChannel}|${module}`
    if (addOnEdits[key] !== undefined) return addOnEdits[key]
    const row = pricing?.addOnPricing?.find(
      (r) => r.countryCode === cc && r.salesChannel === salesChannel && r.module === module
    )
    return row ? Number(row.annualPrice) : ''
  }
  function setAddOnVal(salesChannel, module, val) {
    setAddOnEdits((prev) => ({ ...prev, [`${cc}|${salesChannel}|${module}`]: val }))
  }

  function getVATVal() {
    if (vatEdits[cc] !== undefined) return vatEdits[cc]
    return country ? (Number(country.vatRate || 0) * 100).toFixed(0) : ''
  }

  // ── Save handlers ──
  function handleSaveInventory() {
    const rows = []
    CHANNELS.forEach(({ value: ch }) => {
      PACKAGES.forEach((pkg) => {
        const val = getInvVal(ch, pkg)
        if (val !== '' && val !== null && val !== undefined) {
          rows.push({ countryCode: cc, salesChannel: ch, package: pkg, annualPrice: Number(val), currency: country.currency })
        }
      })
    })
    if (rows.length > 0) saveInventory.mutate(rows)
  }

  function handleSaveAddOn() {
    const rows = []
    CHANNELS.forEach(({ value: ch }) => {
      ADDON_MODULES.forEach(({ value: mod }) => {
        const val = getAddOnVal(ch, mod)
        if (val !== '' && val !== null && val !== undefined) {
          rows.push({ countryCode: cc, salesChannel: ch, module: mod, annualPrice: Number(val), currency: country.currency })
        }
      })
    })
    if (rows.length > 0) saveAddOn.mutate(rows)
  }

  function handleSaveVAT() {
    const pct = getVATVal()
    if (pct !== '' && pct !== null) {
      saveVAT.mutate({ countryCode: cc, vatRate: Number(pct) / 100 })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pricing Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage subscription pricing and one-time service items.</p>
        </div>
        {saveMsg && (
          <span className="text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">{saveMsg}</span>
        )}
      </div>

      {/* Top-level tab toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setPageTab('subscription')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${pageTab === 'subscription' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          📦 Subscription Pricing
        </button>
        <button onClick={() => setPageTab('services')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${pageTab === 'services' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          🔧 Services & One-time Fees
        </button>
      </div>

      {/* Services tab */}
      {pageTab === 'services' && <ServicesSection isAdmin={isAdmin} />}

      {/* Subscription Pricing tab */}
      {pageTab === 'subscription' && <>

      {/* Country tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {countries.map((c) => (
          <button
            key={c.code}
            onClick={() => setActiveCountry(c.code)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              (activeCountry || countries[0]?.code) === c.code
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {country && (
        <>
          {/* ── Inventory Pricing ── */}
          <Section
            title="Inventory Pricing — Normal Branches (Annual, per branch)"
            subtitle={`Currency: ${country.currency}`}
          >
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-44">Sales Channel</th>
                    {PACKAGES.map((p) => (
                      <th key={p} className="px-3 py-2 text-center text-xs font-semibold text-gray-500">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {CHANNELS.map(({ value: ch, label }) => (
                    <tr key={ch} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-medium text-gray-700">{label}</td>
                      {PACKAGES.map((pkg) => (
                        <td key={pkg} className="px-3 py-2 text-center">
                          <PricingInput
                            value={getInvVal(ch, pkg)}
                            onChange={(v) => setInvVal(ch, pkg, v)}
                            disabled={!isAdmin}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <button
                onClick={handleSaveInventory}
                disabled={saveInventory.isPending}
                className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saveInventory.isPending ? 'Saving…' : 'Save Inventory Pricing'}
              </button>
            )}
          </Section>

          {/* ── Add-On Pricing ── */}
          <Section
            title="Add-On Pricing (Annual — no package differentiation)"
            subtitle={`Currency: ${country.currency}  |  CK = Central Kitchen  |  Acct Extra = per extra accounting branch  |  AI Agent = per named user`}
          >
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-44">Sales Channel</th>
                    {ADDON_MODULES.map(({ value, label }) => (
                      <th key={value} className="px-3 py-2 text-center text-xs font-semibold text-gray-500">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {CHANNELS.map(({ value: ch, label }) => (
                    <tr key={ch} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-medium text-gray-700">{label}</td>
                      {ADDON_MODULES.map(({ value: mod }) => (
                        <td key={mod} className="px-3 py-2 text-center">
                          <PricingInput
                            value={getAddOnVal(ch, mod)}
                            onChange={(v) => setAddOnVal(ch, mod, v)}
                            disabled={!isAdmin}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <button
                onClick={handleSaveAddOn}
                disabled={saveAddOn.isPending}
                className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saveAddOn.isPending ? 'Saving…' : 'Save Add-On Pricing'}
              </button>
            )}
          </Section>

          {/* ── VAT Rate ── */}
          <Section title="VAT Rate">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">VAT % for {country.name}</label>
                <div className="flex items-center gap-2">
                  <PricingInput
                    value={getVATVal()}
                    onChange={(v) => setVatEdits((prev) => ({ ...prev, [cc]: v }))}
                    disabled={!isAdmin}
                  />
                  <span className="text-sm text-gray-400">%</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={handleSaveVAT}
                  disabled={saveVAT.isPending}
                  className="mt-4 bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {saveVAT.isPending ? 'Saving…' : 'Save VAT'}
                </button>
              )}
            </div>
          </Section>
        </>
      )}

      </> /* end subscription tab */}
    </div>
  )
}
