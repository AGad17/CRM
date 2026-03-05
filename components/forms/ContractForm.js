'use client'
import { useState } from 'react'
import { contractPeriod } from '@/lib/calculations'

const CONTRACT_TYPES = ['New', 'Renewal', 'Expansion']
const PAYMENT_PLANS = ['Yearly', 'Quarterly']

function calcLineTotal(unitPrice, quantity, paymentPlan) {
  const base = Number(unitPrice) * Number(quantity)
  if (paymentPlan === 'Quarterly') return base * 1.06
  return base
}

export function ContractForm({ initial = {}, accounts = [], products = [], onSubmit, onCancel, loading, isEdit = false }) {
  const [form, setForm] = useState({
    accountId: initial.accountId || '',
    startDate: initial.startDate ? initial.startDate.split('T')[0] : '',
    endDate: initial.endDate ? initial.endDate.split('T')[0] : '',
    type: initial.type || 'New',
    contractValue: initial.contractValue ? String(Number(initial.contractValue)) : '',
  })
  const [items, setItems] = useState(() =>
    (initial.items || []).map((it) => ({
      _key: it.id || Date.now() + Math.random(),
      kind: it.productId ? 'product' : 'onetime',
      productId: it.productId ? String(it.productId) : '',
      description: it.description || '',
      unitPrice: String(Number(it.unitPrice || 0)),
      quantity: it.quantity || 1,
      paymentPlan: it.paymentPlan || 'Yearly',
    }))
  )
  const [errors, setErrors] = useState({})

  const selectedAccount = accounts.find((a) => String(a.id) === String(form.accountId))
  const countryCode = selectedAccount?.countryCode || selectedAccount?.country?.code
  const currency = selectedAccount?.currency || selectedAccount?.country?.currency || ''

  function addProductItem() {
    setItems([...items, { _key: Date.now(), kind: 'product', productId: '', description: '', unitPrice: '', quantity: 1, paymentPlan: 'Yearly' }])
  }

  function addOneTimeItem() {
    setItems([...items, { _key: Date.now(), kind: 'onetime', productId: null, description: '', unitPrice: '', quantity: 1, paymentPlan: 'OneTime' }])
  }

  function updateItem(key, patch) {
    setItems(items.map((it) => {
      if (it._key !== key) return it
      const updated = { ...it, ...patch }
      if (patch.productId !== undefined && patch.productId) {
        const product = products.find((p) => String(p.id) === String(patch.productId))
        if (product && countryCode) {
          const pricing = product.currentPricing?.[countryCode]
          if (pricing) {
            updated.unitPrice = String(Number(pricing.price))
            updated.description = product.name
          }
        }
      }
      return updated
    }))
  }

  function removeItem(key) {
    setItems(items.filter((it) => it._key !== key))
  }

  const grandTotal = items.reduce((sum, it) => {
    if (!it.unitPrice || !it.quantity) return sum
    return sum + calcLineTotal(it.unitPrice, it.quantity, it.paymentPlan)
  }, 0)

  const period = form.startDate && form.endDate && new Date(form.endDate) >= new Date(form.startDate)
    ? contractPeriod(form.startDate, form.endDate)
    : null
  const mrrPreview = period && grandTotal > 0 ? grandTotal / period : null

  function validate() {
    const e = {}
    if (!isEdit && !form.accountId) e.accountId = 'Required'
    if (!form.startDate) e.startDate = 'Required'
    if (!form.endDate) e.endDate = 'Required'
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) e.endDate = 'Must be >= start date'
    if (!form.type) e.type = 'Required'
    if (items.length === 0 && isEdit) {
      if (!form.contractValue || Number(form.contractValue) <= 0) e.contractValue = 'Required when there are no line items'
    } else if (items.length === 0) {
      e.items = 'Add at least one line item'
    }
    items.forEach((it, i) => {
      if (!it.description.trim()) e[`item_${i}_desc`] = 'Required'
      if (!it.unitPrice || Number(it.unitPrice) <= 0) e[`item_${i}_price`] = 'Must be > 0'
    })
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length > 0) { setErrors(e2); return }

    const payload = {
      startDate: form.startDate,
      endDate: form.endDate,
      type: form.type,
    }
    if (!isEdit) payload.accountId = Number(form.accountId)
    if (items.length > 0) {
      payload.items = items.map((it) => ({
        productId: it.productId ? Number(it.productId) : null,
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice),
        paymentPlan: it.paymentPlan,
      }))
    } else {
      payload.contractValue = Number(form.contractValue)
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Account + Type */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account" error={errors.accountId}>
          {isEdit ? (
            <div className={`${inp()} bg-gray-50 text-gray-500 cursor-not-allowed`}>
              {initial.account?.name || accounts.find((a) => String(a.id) === String(form.accountId))?.name || '—'}
            </div>
          ) : (
            <select className={inp(errors.accountId)} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.countryCode || a.country?.code})</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Contract Type *" error={errors.type}>
          <select className={inp(errors.type)} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date *" error={errors.startDate}>
          <input type="date" className={inp(errors.startDate)} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field label="End Date *" error={errors.endDate}>
          <input type="date" className={inp(errors.endDate)} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </Field>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Line Items *</label>
          <div className="flex gap-2">
            <button type="button" onClick={addProductItem} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors font-medium">+ Product</button>
            <button type="button" onClick={addOneTimeItem} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors font-medium">+ One-time</button>
          </div>
        </div>

        {errors.items && <p className="text-xs text-red-500 mb-2">{errors.items}</p>}

        {items.length === 0 && (
          <div className="text-center py-6 bg-gray-50 rounded-xl text-xs text-gray-400 border border-dashed border-gray-200">
            Add product or one-time service items above
          </div>
        )}

        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it._key} className={`rounded-xl border p-3 space-y-2 ${it.kind === 'product' ? 'border-indigo-100 bg-indigo-50/30' : 'border-amber-100 bg-amber-50/30'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${it.kind === 'product' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                  {it.kind === 'product' ? 'Product' : 'One-time'}
                </span>
                <button type="button" onClick={() => removeItem(it._key)} className="ml-auto text-gray-400 hover:text-red-500 text-sm leading-none">✕</button>
              </div>

              {it.kind === 'product' ? (
                <>
                  <select
                    className={inp(errors[`item_${i}_desc`])}
                    value={it.productId}
                    onChange={(e) => updateItem(it._key, { productId: e.target.value })}
                  >
                    <option value="">Select product…</option>
                    {products.filter((p) => p.isActive).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                    ))}
                  </select>
                  {it.productId && (
                    <input
                      type="text"
                      placeholder="Description"
                      className={inp()}
                      value={it.description}
                      onChange={(e) => updateItem(it._key, { description: e.target.value })}
                    />
                  )}
                </>
              ) : (
                <input
                  type="text"
                  placeholder="Service description *"
                  className={inp(errors[`item_${i}_desc`])}
                  value={it.description}
                  onChange={(e) => updateItem(it._key, { description: e.target.value })}
                />
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unit Price{currency ? ` (${currency})` : ''} *</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    className={inp(errors[`item_${i}_price`])}
                    value={it.unitPrice}
                    onChange={(e) => updateItem(it._key, { unitPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Qty</label>
                  <input
                    type="number" min="1" step="1"
                    className={inp()}
                    value={it.quantity}
                    onChange={(e) => updateItem(it._key, { quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Plan</label>
                  {it.kind === 'onetime' ? (
                    <input className={inp()} value="One-time" readOnly />
                  ) : (
                    <select className={inp()} value={it.paymentPlan} onChange={(e) => updateItem(it._key, { paymentPlan: e.target.value })}>
                      {PAYMENT_PLANS.map((p) => <option key={p} value={p}>{p}{p === 'Quarterly' ? ' (+6%)' : ''}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {it.unitPrice && it.quantity && (
                <p className="text-right text-xs text-gray-600 font-medium">
                  Line total: {currency} {calcLineTotal(it.unitPrice, it.quantity, it.paymentPlan).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Direct contract value (edit mode, no items) */}
      {isEdit && items.length === 0 && (
        <Field label="Contract Value (USD) *" error={errors.contractValue}>
          <input
            type="number" min="0.01" step="0.01"
            className={inp(errors.contractValue)}
            value={form.contractValue}
            onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
            placeholder="0.00"
          />
        </Field>
      )}

      {/* Grand Total Preview */}
      {grandTotal > 0 && (
        <div className="bg-indigo-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-xs text-indigo-400 font-medium">Total Value</p>
            <p className="font-bold text-indigo-700">{currency} {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-400 font-medium">Period</p>
            <p className="font-bold text-indigo-700">{period ? `${period} mo` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-400 font-medium">MRR</p>
            <p className="font-bold text-indigo-700">{mrrPreview ? `${currency} ${mrrPreview.toFixed(2)}` : '—'}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {loading ? 'Saving…' : 'Save Contract'}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function inp(error) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-indigo-400'}`
}
