'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { UserForm } from '@/components/forms/UserForm'

const ROLE_LABELS = {
  CCO_ADMIN: 'CCO Admin',
  REVENUE_MANAGER: 'Revenue Manager',
  CUSTOMER_SUCCESS: 'Customer Success',
  READ_ONLY: 'Read Only',
}

const ROLES = Object.keys(ROLE_LABELS)

// Common ISO 4217 currency suggestions by country keyword
const CURRENCY_HINTS = { SAR: 'SAR', EGP: 'EGP', AED: 'AED', BHD: 'BHD', JOD: 'JOD', KWD: 'KWD', OMR: 'OMR', QAR: 'QAR', USD: 'USD', EUR: 'EUR', GBP: 'GBP' }

export default function SettingsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('countries')

  // ── Countries ──────────────────────────────────────────────────────────────
  const { data: countries = [], isLoading: countriesLoading } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const [countryForm, setCountryForm] = useState({ code: '', name: '', currency: '' })
  const [countryErrors, setCountryErrors] = useState({})
  const [editCountry, setEditCountry] = useState(null)

  const createCountry = useMutation({
    mutationFn: (data) => fetch('/api/countries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['countries']); setCountryForm({ code: '', name: '', currency: '' }); setCountryErrors({}) },
  })

  const updateCountry = useMutation({
    mutationFn: ({ id, ...data }) => fetch(`/api/countries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['countries']); setEditCountry(null) },
  })

  const deleteCountry = useMutation({
    mutationFn: (id) => fetch(`/api/countries/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) alert(res.error)
      else qc.invalidateQueries(['countries'])
    },
  })

  function validateCountry(form) {
    const e = {}
    if (!form.code.trim()) e.code = 'Required'
    if (!form.name.trim()) e.name = 'Required'
    if (!form.currency.trim()) e.currency = 'Required'
    return e
  }

  function handleAddCountry(e) {
    e.preventDefault()
    const errs = validateCountry(countryForm)
    if (Object.keys(errs).length) { setCountryErrors(errs); return }
    createCountry.mutate({ code: countryForm.code.toUpperCase(), name: countryForm.name, currency: countryForm.currency.toUpperCase() })
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then((r) => r.json()),
    retry: false,
  })

  const [userModal, setUserModal] = useState(null)

  const createUser = useMutation({
    mutationFn: (data) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['users']); setUserModal(null) },
  })

  const updateUser = useMutation({
    mutationFn: ({ id, ...data }) => fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries(['users']),
  })

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['countries', 'Countries'], ['team', 'Team']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Countries tab ── */}
      {tab === 'countries' && (
        <div className="space-y-5">
          {/* Add country form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Add Country</h3>
            <form onSubmit={handleAddCountry} className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Code *</label>
                <input
                  className={cInp(countryErrors.code)}
                  value={countryForm.code}
                  onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value })}
                  placeholder="e.g. UAE"
                  maxLength={10}
                />
                {countryErrors.code && <p className="text-xs text-red-500 mt-1">{countryErrors.code}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input
                  className={cInp(countryErrors.name)}
                  value={countryForm.name}
                  onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })}
                  placeholder="e.g. United Arab Emirates"
                />
                {countryErrors.name && <p className="text-xs text-red-500 mt-1">{countryErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency *</label>
                <input
                  list="currencies"
                  className={cInp(countryErrors.currency)}
                  value={countryForm.currency}
                  onChange={(e) => setCountryForm({ ...countryForm, currency: e.target.value })}
                  placeholder="e.g. AED"
                  maxLength={5}
                />
                <datalist id="currencies">
                  {Object.keys(CURRENCY_HINTS).map((c) => <option key={c} value={c} />)}
                </datalist>
                {countryErrors.currency && <p className="text-xs text-red-500 mt-1">{countryErrors.currency}</p>}
              </div>
              <button
                type="submit"
                disabled={createCountry.isPending}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createCountry.isPending ? 'Adding…' : 'Add Country'}
              </button>
            </form>
          </div>

          {/* Countries table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {countriesLoading ? (
              <div className="animate-pulse h-40 bg-gray-100" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Currency</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {countries.map((c) => (
                    <tr key={c.id}>
                      {editCountry?.id === c.id ? (
                        <>
                          <td className="px-5 py-2"><input className={cInp()} value={editCountry.code} onChange={(e) => setEditCountry({ ...editCountry, code: e.target.value })} /></td>
                          <td className="px-4 py-2"><input className={cInp()} value={editCountry.name} onChange={(e) => setEditCountry({ ...editCountry, name: e.target.value })} /></td>
                          <td className="px-4 py-2"><input className={cInp()} value={editCountry.currency} onChange={(e) => setEditCountry({ ...editCountry, currency: e.target.value })} maxLength={5} /></td>
                          <td className="px-4 py-2">
                            <select className={cInp()} value={editCountry.isActive ? 'true' : 'false'} onChange={(e) => setEditCountry({ ...editCountry, isActive: e.target.value === 'true' })}>
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 flex gap-2">
                            <button onClick={() => updateCountry.mutate(editCountry)} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">Save</button>
                            <button onClick={() => setEditCountry(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3 font-mono text-xs text-gray-700 font-medium">{c.code}</td>
                          <td className="px-4 py-3 text-gray-900">{c.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.currency}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {c.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setEditCountry({ ...c })} className="text-xs text-gray-400 hover:text-indigo-600 mr-3">Edit</button>
                            <button onClick={() => { if (confirm(`Delete ${c.name}?`)) deleteCountry.mutate(c.id) }} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Team tab ── */}
      {tab === 'team' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button onClick={() => setUserModal('create')} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
              + Invite Member
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {usersLoading ? (
              <div className="animate-pulse h-40 bg-gray-100" />
            ) : users.error ? (
              <div className="text-center py-10 text-sm text-gray-400">Admin access required to manage team.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(Array.isArray(users) ? users : []).map((u) => (
                    <tr key={u.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{u.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          value={u.role}
                          onChange={(e) => updateUser.mutate({ id: u.id, role: e.target.value })}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.isActive ? (
                          <button
                            onClick={() => { if (confirm(`Deactivate ${u.email}?`)) updateUser.mutate({ id: u.id, isActive: false }) }}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => updateUser.mutate({ id: u.id, isActive: true })}
                            className="text-xs text-indigo-500 hover:text-indigo-700"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Invite user modal */}
      <Modal isOpen={userModal === 'create'} onClose={() => setUserModal(null)} title="Invite Member">
        <UserForm
          onSubmit={(data) => createUser.mutate(data)}
          onCancel={() => setUserModal(null)}
          loading={createUser.isPending}
        />
      </Modal>
    </div>
  )
}

function cInp(error) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${error ? 'border-red-400' : 'border-gray-200 focus:border-indigo-400'}`
}
