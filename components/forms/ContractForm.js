'use client'
import { useState, useEffect } from 'react'
import { contractPeriod, mrr } from '@/lib/calculations'

const CONTRACT_TYPES = ['New', 'Renewal', 'Expansion']

export function ContractForm({ initial = {}, accounts = [], onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    accountId: initial.accountId || '',
    contractValue: initial.contractValue || '',
    startDate: initial.startDate ? initial.startDate.split('T')[0] : '',
    endDate: initial.endDate ? initial.endDate.split('T')[0] : '',
    type: initial.type || 'New',
  })
  const [errors, setErrors] = useState({})
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (form.contractValue && form.startDate && form.endDate && new Date(form.endDate) >= new Date(form.startDate)) {
      const period = contractPeriod(form.startDate, form.endDate)
      const mrrVal = mrr(Number(form.contractValue), period)
      setPreview({ period, mrr: mrrVal, arr: mrrVal * 12 })
    } else {
      setPreview(null)
    }
  }, [form.contractValue, form.startDate, form.endDate])

  function validate() {
    const e = {}
    if (!form.accountId) e.accountId = 'Required'
    if (!form.contractValue || Number(form.contractValue) <= 0) e.contractValue = 'Must be > 0'
    if (!form.startDate) e.startDate = 'Required'
    if (!form.endDate) e.endDate = 'Required'
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) e.endDate = 'Must be ≥ start date'
    if (!form.type) e.type = 'Required'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length > 0) { setErrors(e2); return }
    onSubmit({ ...form, accountId: Number(form.accountId), contractValue: Number(form.contractValue) })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Account *" error={errors.accountId}>
        <select className={inp(errors.accountId)} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
          <option value="">Select account…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.country})</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Contract Type *" error={errors.type}>
          <select className={inp(errors.type)} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Contract Value (SAR/EGP) *" error={errors.contractValue}>
          <input type="number" min="0.01" step="0.01" className={inp(errors.contractValue)} value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value })} placeholder="e.g. 12000" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date *" error={errors.startDate}>
          <input type="date" className={inp(errors.startDate)} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field label="End Date *" error={errors.endDate}>
          <input type="date" className={inp(errors.endDate)} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </Field>
      </div>

      {preview && (
        <div className="bg-indigo-50 rounded-xl p-4 text-sm grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-indigo-400 font-medium">Period</p>
            <p className="font-bold text-indigo-700">{preview.period} mo</p>
          </div>
          <div>
            <p className="text-xs text-indigo-400 font-medium">MRR</p>
            <p className="font-bold text-indigo-700">SAR {preview.mrr.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-400 font-medium">ARR</p>
            <p className="font-bold text-indigo-700">SAR {preview.arr.toFixed(2)}</p>
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
