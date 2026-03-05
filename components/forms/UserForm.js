'use client'
import { useState } from 'react'

const ROLES = [
  { value: 'CCO_ADMIN', label: 'CCO Admin' },
  { value: 'REVENUE_MANAGER', label: 'Revenue Manager' },
  { value: 'CUSTOMER_SUCCESS', label: 'Customer Success' },
  { value: 'READ_ONLY', label: 'Read Only' },
]

export function UserForm({ onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'READ_ONLY' })
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (!form.password || form.password.length < 6) e.password = 'Min 6 characters'
    if (!form.role) e.role = 'Required'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({ name: form.name || undefined, email: form.email, password: form.password, role: form.role })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Name (optional)">
        <input type="text" className={inp()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
      </Field>

      <Field label="Email *" error={errors.email}>
        <input type="email" className={inp(errors.email)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" />
      </Field>

      <Field label="Temporary Password *" error={errors.password}>
        <input type="password" className={inp(errors.password)} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
      </Field>

      <Field label="Role *" error={errors.role}>
        <select className={inp(errors.role)} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {loading ? 'Saving…' : 'Create Account'}
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
