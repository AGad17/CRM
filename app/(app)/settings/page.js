'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Modal } from '@/components/ui/Modal'
import { UserForm } from '@/components/forms/UserForm'
import { MODULES, ACTIONS, ROLE_DEFAULTS } from '@/lib/permissionsConfig'

const ROLE_LABELS = {
  CCO_ADMIN: 'CCO Admin',
  REVENUE_MANAGER: 'Revenue Manager',
  CUSTOMER_SUCCESS: 'Customer Success',
  READ_ONLY: 'Read Only',
}
const MODULE_LABELS = {
  dashboard: 'Dashboard', accounts: 'Accounts', pipeline: 'Pipeline',
  onboarding: 'Onboarding', invoicing: 'Invoicing', analytics: 'Analytics', settings: 'Settings',
}
const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', admin: 'Admin' }
const ACTION_COLORS = {
  view:   'bg-blue-50 text-blue-700 border-blue-200',
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  edit:   'bg-amber-50 text-amber-700 border-amber-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  admin:  'bg-purple-50 text-purple-700 border-purple-200',
}
const SYSTEM_ROLES = Object.keys(ROLE_LABELS)
const CURRENCY_HINTS = { SAR: 'SAR', EGP: 'EGP', AED: 'AED', BHD: 'BHD', JOD: 'JOD', KWD: 'KWD', OMR: 'OMR', QAR: 'QAR', USD: 'USD', EUR: 'EUR', GBP: 'GBP' }

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'CCO_ADMIN'
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
    onSuccess: (res) => { if (res.error) alert(res.error); else qc.invalidateQueries(['countries']) },
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

  // ── Custom Roles ───────────────────────────────────────────────────────────
  const { data: customRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => fetch('/api/roles').then((r) => r.json()),
    enabled: isAdmin,
    retry: false,
  })
  const [roleModal, setRoleModal] = useState(null) // null | 'create' | roleObject

  const createRoleMut = useMutation({
    mutationFn: (data) => fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: (res) => { if (!res.error) { qc.invalidateQueries(['custom-roles']); setRoleModal(null) } },
  })
  const updateRoleMut = useMutation({
    mutationFn: ({ id, ...data }) => fetch(`/api/roles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: (res) => { if (!res.error) { qc.invalidateQueries(['custom-roles']); qc.invalidateQueries(['users']); setRoleModal(null) } },
  })
  const deleteRoleMut = useMutation({
    mutationFn: (id) => fetch(`/api/roles/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: (res) => { if (res.error) alert(res.error); else qc.invalidateQueries(['custom-roles']) },
  })

  // ── Users ──────────────────────────────────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then((r) => r.json()),
    retry: false,
  })
  const [userModal, setUserModal] = useState(null)
  const [permModal, setPermModal] = useState(null)

  const createUser = useMutation({
    mutationFn: (data) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['users']); setUserModal(null) },
  })
  const updateUser = useMutation({
    mutationFn: ({ id, ...data }) => fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: (res) => { if (res.error) alert(res.error); else qc.invalidateQueries(['users']) },
  })
  const updatePerms = useMutation({
    mutationFn: ({ id, permissions }) =>
      fetch(`/api/users/${id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['users']); setPermModal(null) },
  })

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['countries', 'Countries'], ['roles', 'Custom Roles'], ['team', 'Team']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
            {val === 'roles' && Array.isArray(customRoles) && customRoles.length > 0 && (
              <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">{customRoles.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Countries tab ── */}
      {tab === 'countries' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Add Country</h3>
            <form onSubmit={handleAddCountry} className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Code *</label>
                <input className={cInp(countryErrors.code)} value={countryForm.code} onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value })} placeholder="e.g. UAE" maxLength={10} />
                {countryErrors.code && <p className="text-xs text-red-500 mt-1">{countryErrors.code}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input className={cInp(countryErrors.name)} value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} placeholder="e.g. United Arab Emirates" />
                {countryErrors.name && <p className="text-xs text-red-500 mt-1">{countryErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency *</label>
                <input list="currencies" className={cInp(countryErrors.currency)} value={countryForm.currency} onChange={(e) => setCountryForm({ ...countryForm, currency: e.target.value })} placeholder="e.g. AED" maxLength={5} />
                <datalist id="currencies">{Object.keys(CURRENCY_HINTS).map((c) => <option key={c} value={c} />)}</datalist>
                {countryErrors.currency && <p className="text-xs text-red-500 mt-1">{countryErrors.currency}</p>}
              </div>
              <button type="submit" disabled={createCountry.isPending} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {createCountry.isPending ? 'Adding\u2026' : 'Add Country'}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {countriesLoading ? <div className="animate-pulse h-40 bg-gray-100" /> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Currency</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr></thead>
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

      {/* ── Custom Roles tab ── */}
      {tab === 'roles' && (
        <div className="space-y-5">
          {!isAdmin ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
              Admin access required to manage custom roles.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Custom roles define what each team member can access. Assign a role to a user in the Team tab — their permissions take effect immediately.
                </p>
                <button
                  onClick={() => setRoleModal('create')}
                  className="ml-4 shrink-0 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  + Create Role
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {rolesLoading ? <div className="animate-pulse h-40 bg-gray-100" /> :
                 Array.isArray(customRoles) && customRoles.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-4xl mb-3">🔑</p>
                    <p className="font-semibold text-gray-600 text-lg">No custom roles yet</p>
                    <p className="text-sm text-gray-400 mt-1">Create a role to define a reusable set of permissions.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissions</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Users</th>
                      <th className="px-4 py-3" />
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {(Array.isArray(customRoles) ? customRoles : []).map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="font-semibold text-gray-900">{r.name}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.description || <span className="italic text-gray-300">No description</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {MODULES.filter(m => Object.values(r.permissions?.[m] || {}).some(Boolean)).map(m => (
                                <span key={m} className="bg-indigo-50 text-indigo-600 text-xs px-1.5 py-0.5 rounded font-medium">{MODULE_LABELS[m]}</span>
                              ))}
                              {MODULES.every(m => !Object.values(r.permissions?.[m] || {}).some(Boolean)) && (
                                <span className="text-xs text-gray-300 italic">No permissions</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {r.userCount > 0 ? (
                              <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">{r.userCount} user{r.userCount !== 1 ? 's' : ''}</span>
                            ) : (
                              <span className="text-gray-300 text-xs">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => setRoleModal(r)} className="text-xs text-indigo-500 hover:text-indigo-700 mr-3 font-medium">Edit</button>
                            <button
                              onClick={() => {
                                if (r.userCount > 0) { alert(`Cannot delete: ${r.userCount} user${r.userCount > 1 ? 's are' : ' is'} assigned this role.`); return }
                                if (confirm(`Delete role "${r.name}"?`)) deleteRoleMut.mutate(r.id)
                              }}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
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
            {usersLoading ? <div className="animate-pulse h-40 bg-gray-100" /> :
             users.error ? (
              <div className="text-center py-10 text-sm text-gray-400">Admin access required to manage team.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Overrides</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(Array.isArray(users) ? users : []).map((u) => {
                    const isCCOAdmin = u.role === 'CCO_ADMIN'
                    const basePerms = getBasePerms(u)
                    const overrideCount = countOverrides(basePerms, u.permissions || {})
                    return (
                      <tr key={u.id}>
                        <td className="px-5 py-3 font-medium text-gray-900">{u.name || '\u2014'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          {isCCOAdmin ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Admin</span>
                          ) : isAdmin ? (
                            <select
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white max-w-[180px]"
                              value={u.customRole?.id || ''}
                              onChange={(e) => updateUser.mutate({ id: u.id, customRoleId: e.target.value || null })}
                            >
                              <option value="">\u2014 No Role (Read Only)</option>
                              {(Array.isArray(customRoles) ? customRoles : []).map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          ) : (
                            u.customRole
                              ? <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold">{u.customRole.name}</span>
                              : <span className="text-xs text-gray-400 italic">No role</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin && !isCCOAdmin ? (
                            <button
                              onClick={() => setPermModal(u)}
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                            >
                              <span>\u270f\ufe0f</span>
                              {overrideCount > 0 ? (
                                <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                                  {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-gray-400">
                                  {u.customRole ? `Base: ${u.customRole.name}` : 'No overrides'}
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {!isCCOAdmin && overrideCount > 0 ? `${overrideCount} override${overrideCount !== 1 ? 's' : ''}` : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (u.isActive ? (
                            <button onClick={() => { if (confirm(`Deactivate ${u.email}?`)) updateUser.mutate({ id: u.id, isActive: false }) }} className="text-xs text-red-400 hover:text-red-600">Deactivate</button>
                          ) : (
                            <button onClick={() => updateUser.mutate({ id: u.id, isActive: true })} className="text-xs text-indigo-500 hover:text-indigo-700">Reactivate</button>
                          ))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

      {/* Invite user modal */}
      <Modal isOpen={userModal === 'create'} onClose={() => setUserModal(null)} title="Invite Member">
        <UserForm onSubmit={(data) => createUser.mutate(data)} onCancel={() => setUserModal(null)} loading={createUser.isPending} />
      </Modal>

      {/* Custom role create/edit modal */}
      {roleModal && (
        <RoleModal
          role={roleModal === 'create' ? null : roleModal}
          onSave={(data) => {
            if (roleModal === 'create') createRoleMut.mutate(data)
            else updateRoleMut.mutate({ id: roleModal.id, ...data })
          }}
          onClose={() => setRoleModal(null)}
          saving={createRoleMut.isPending || updateRoleMut.isPending}
        />
      )}

      {/* User permissions override modal */}
      {permModal && (
        <PermissionsModal
          user={permModal}
          onSave={(permissions) => updatePerms.mutate({ id: permModal.id, permissions })}
          onClose={() => setPermModal(null)}
          saving={updatePerms.isPending}
        />
      )}
    </div>
  )
}

// ── Custom Role Create/Edit Modal ─────────────────────────────────────────────

function RoleModal({ role, onSave, onClose, saving }) {
  const isEdit = !!role
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [nameErr, setNameErr] = useState('')

  // Permission matrix: start from role.permissions or empty
  const [perms, setPerms] = useState(() => {
    const p = {}
    for (const mod of MODULES) {
      p[mod] = {}
      for (const action of ACTIONS) {
        p[mod][action] = role?.permissions?.[mod]?.[action] === true
      }
    }
    return p
  })

  function toggle(mod, action) {
    setPerms((prev) => ({ ...prev, [mod]: { ...prev[mod], [action]: !prev[mod][action] } }))
  }

  function handleSave() {
    if (!name.trim()) { setNameErr('Role name is required'); return }
    // Build permissions: only include true values
    const permissions = {}
    for (const mod of MODULES) {
      for (const action of ACTIONS) {
        if (perms[mod][action]) {
          if (!permissions[mod]) permissions[mod] = {}
          permissions[mod][action] = true
        }
      }
    }
    onSave({ name: name.trim(), description: description.trim() || null, permissions })
  }

  const grantedCount = MODULES.reduce((sum, mod) => sum + ACTIONS.filter(a => perms[mod][a]).length, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? `Edit Role: ${role.name}` : 'Create Custom Role'}</h2>
            <p className="text-sm text-gray-400 mt-0.5">Define a reusable set of module permissions for this role.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">\u2715</button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Name + Description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role Name *</label>
              <input
                className={cInp(nameErr)}
                value={name}
                onChange={(e) => { setName(e.target.value); setNameErr('') }}
                placeholder="e.g. Sales Lead"
              />
              {nameErr && <p className="text-xs text-red-500 mt-1">{nameErr}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
              <input
                className={cInp()}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional — what is this role for?"
              />
            </div>
          </div>

          {/* Permission matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Module Permissions</label>
              {grantedCount > 0 && (
                <span className="text-xs text-indigo-600 font-medium">{grantedCount} permission{grantedCount !== 1 ? 's' : ''} granted</span>
              )}
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Module</th>
                    {ACTIONS.map((action) => (
                      <th key={action} className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ACTION_COLORS[action]}`}>
                          {ACTION_LABELS[action]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {MODULES.map((mod) => (
                    <tr key={mod} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800 text-sm">{MODULE_LABELS[mod]}</td>
                      {ACTIONS.map((action) => {
                        const granted = perms[mod][action]
                        return (
                          <td key={action} className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => toggle(mod, action)}
                              className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center mx-auto ${
                                granted ? 'border-indigo-400 bg-indigo-500 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-300 hover:border-gray-300'
                              }`}
                            >
                              {granted && (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving\u2026' : isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── User Permissions Override Modal ───────────────────────────────────────────

function PermissionsModal({ user, onSave, onClose, saving }) {
  // Base = custom role permissions (if assigned) or READ_ONLY system defaults
  const basePerms = getBasePerms(user)

  const currentOverrides = user.permissions || {}

  const [draft, setDraft] = useState(() => {
    const d = {}
    for (const mod of MODULES) {
      d[mod] = {}
      for (const action of ACTIONS) {
        // Start from base, then apply any saved overrides
        const baseVal = basePerms[mod]?.[action] === true
        if (currentOverrides[mod]?.[action] !== undefined) {
          d[mod][action] = currentOverrides[mod][action]
        } else {
          d[mod][action] = baseVal
        }
      }
    }
    return d
  })

  function toggle(mod, action) {
    setDraft((prev) => ({ ...prev, [mod]: { ...prev[mod], [action]: !prev[mod][action] } }))
  }

  function isOverridden(mod, action) {
    return draft[mod][action] !== (basePerms[mod]?.[action] === true)
  }

  function resetToDefaults() {
    const d = {}
    for (const mod of MODULES) {
      d[mod] = {}
      for (const action of ACTIONS) {
        d[mod][action] = basePerms[mod]?.[action] === true
      }
    }
    setDraft(d)
  }

  function handleSave() {
    const overrides = {}
    for (const mod of MODULES) {
      for (const action of ACTIONS) {
        const baseVal = basePerms[mod]?.[action] === true
        if (draft[mod][action] !== baseVal) {
          if (!overrides[mod]) overrides[mod] = {}
          overrides[mod][action] = draft[mod][action]
        }
      }
    }
    onSave(overrides)
  }

  const totalOverrides = MODULES.reduce((sum, mod) => sum + ACTIONS.filter(a => isOverridden(mod, a)).length, 0)
  const baseLabel = user.customRole ? user.customRole.name : 'Read Only (default)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Permission Overrides</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-medium text-gray-700">{user.name || user.email}</span>
              {' \u00b7 '}
              <span className="text-indigo-600">{user.customRole ? user.customRole.name : 'No Role'}</span>
              {totalOverrides > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {totalOverrides} override{totalOverrides !== 1 ? 's' : ''}
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Overrides are applied on top of the &ldquo;{baseLabel}&rdquo; base permissions. Green = granted by role, indigo = manually granted, red X = manually revoked.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">\u2715</button>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-5 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-indigo-400 bg-indigo-500 inline-block" />Granted (override)</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-emerald-300 bg-emerald-400 inline-block" />Granted (role default)</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-red-300 bg-red-50 inline-block" />Revoked (override)</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-200 bg-white inline-block" />Not granted</span>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Module</th>
                {ACTIONS.map((action) => (
                  <th key={action} className="pb-3 px-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ACTION_COLORS[action]}`}>
                      {ACTION_LABELS[action]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MODULES.map((mod) => (
                <tr key={mod} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 pr-4 font-medium text-gray-800 text-sm">{MODULE_LABELS[mod]}</td>
                  {ACTIONS.map((action) => {
                    const granted = draft[mod][action]
                    const overridden = isOverridden(mod, action)
                    return (
                      <td key={action} className="py-3 px-2 text-center">
                        <button
                          onClick={() => toggle(mod, action)}
                          className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center mx-auto ${
                            granted && overridden  ? 'border-indigo-400 bg-indigo-500 text-white shadow-sm shadow-indigo-200' :
                            granted && !overridden ? 'border-emerald-300 bg-emerald-400 text-white' :
                            !granted && overridden ? 'border-red-300 bg-red-50 text-red-400' :
                            'border-gray-200 bg-white text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          {granted ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : overridden ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : null}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={resetToDefaults} className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors">
            Reset to role defaults
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving\u2026' : 'Save Overrides'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns the effective base permissions for a user:
// custom role permissions (if assigned) or READ_ONLY system defaults
function getBasePerms(user) {
  if (user.customRole?.permissions) return user.customRole.permissions
  return ROLE_DEFAULTS[user.role] || ROLE_DEFAULTS.READ_ONLY || {}
}

function countOverrides(basePerms, perms) {
  let count = 0
  for (const mod of MODULES) {
    if (!perms[mod]) continue
    for (const action of ACTIONS) {
      if (perms[mod][action] !== undefined && perms[mod][action] !== (basePerms[mod]?.[action] === true)) count++
    }
  }
  return count
}

function cInp(error) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${error ? 'border-red-400' : 'border-gray-200 focus:border-indigo-400'}`
}
