'use client'
import { useState } from 'react'

const LEAD_SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']
const COUNTRIES = ['KSA', 'Egypt', 'UAE', 'Bahrain', 'Jordan']

export function AccountForm({ initial = {}, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    leadSource: initial.leadSource || '',
    country: initial.country || '',
    brands: initial.brands || 1,
    numberOfBranches: initial.numberOfBranches || 1,
    numberOfCostCentres: initial.numberOfCostCentres || '',
  })
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.leadSource) e.leadSource = 'Required'
    if (!form.country) e.country = 'Required'
    if (!form.brands || form.brands < 1) e.brands = 'Must be ≥ 1'
    if (!form.numberOfBranches || form.numberOfBranches < 1) e.numberOfBranches = 'Must be ≥ 1'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length > 0) { setErrors(e2); return }
    onSubmit({
      ...form,
      brands: Number(form.brands),
      numberOfBranches: Number(form.numberOfBranches),
      numberOfCostCentres: form.numberOfCostCentres ? Number(form.numberOfCostCentres) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Account Name *" error={errors.name}>
        <input className={input(errors.name)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Al Baik" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Lead Source *" error={errors.leadSource}>
          <select className={input(errors.leadSource)} value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })}>
            <option value="">Select…</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/([A-Z])/g, ' $1').trim()}</option>)}
          </select>
        </Field>
        <Field label="Country *" error={errors.country}>
          <select className={input(errors.country)} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            <option value="">Select…</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Brands *" error={errors.brands}>
          <input type="number" min="1" className={input(errors.brands)} value={form.brands} onChange={(e) => setForm({ ...form, brands: e.target.value })} />
        </Field>
        <Field label="Branches *" error={errors.numberOfBranches}>
          <input type="number" min="1" className={input(errors.numberOfBranches)} value={form.numberOfBranches} onChange={(e) => setForm({ ...form, numberOfBranches: e.target.value })} />
        </Field>
        <Field label="Cost Centres">
          <input type="number" min="0" className={input()} value={form.numberOfCostCentres} onChange={(e) => setForm({ ...form, numberOfCostCentres: e.target.value })} placeholder="Optional" />
        </Field>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {loading ? 'Saving…' : 'Save Account'}
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

function input(error) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-indigo-400'}`
}
