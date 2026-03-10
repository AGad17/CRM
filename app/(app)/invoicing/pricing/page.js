'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

const PACKAGES    = ['Essential', 'Operations', 'Enterprise']
const BRANCH_TYPES = ['Normal', 'CentralKitchen', 'Warehouse']
const MODULES      = ['Butchering', 'AIAgent']

function cell(val) {
  return val !== undefined && val !== null ? Number(val) : ''
}

function PricingInput({ value, onChange, disabled }) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
      placeholder="—"
    />
  )
}

export default function PricingConfigPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const isAdmin = session?.user?.role === 'CCO_ADMIN'

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['invoicing-pricing'],
    queryFn: () => fetch('/api/invoicing/pricing').then((r) => r.json()),
    staleTime: 30_000,
  })

  const saveBranch = useMutation({
    mutationFn: (rows) => fetch('/api/invoicing/pricing/branch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries(['invoicing-pricing']),
  })

  const saveAccounting = useMutation({
    mutationFn: (rows) => fetch('/api/invoicing/pricing/accounting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries(['invoicing-pricing']),
  })

  const saveFlat = useMutation({
    mutationFn: (rows) => fetch('/api/invoicing/pricing/flat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries(['invoicing-pricing']),
  })

  const saveVAT = useMutation({
    mutationFn: ({ countryCode, vatRate }) => fetch('/api/invoicing/pricing/vat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ countryCode, vatRate }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries(['invoicing-pricing']),
  })

  // Local state for edits
  const [branchEdits, setBranchEdits]       = useState({})
  const [accountingEdits, setAccountingEdits] = useState({})
  const [flatEdits, setFlatEdits]             = useState({})
  const [vatEdits, setVatEdits]               = useState({})

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />

  const countries = pricing?.countries || []

  // Helpers to get current value (edit override > DB)
  function getBranchVal(countryCode, pkg, branchType) {
    const key = `${countryCode}|${pkg}|${branchType}`
    if (branchEdits[key] !== undefined) return branchEdits[key]
    const row = pricing.branchPricing.find((r) => r.countryCode === countryCode && r.package === pkg && r.branchType === branchType)
    return cell(row?.price)
  }

  function getAccountingVal(countryCode, pkg, isMain) {
    const key = `${countryCode}|${pkg}|${isMain}`
    if (accountingEdits[key] !== undefined) return accountingEdits[key]
    const row = pricing.accountingPricing.find((r) => r.countryCode === countryCode && r.package === pkg && r.isMainLicense === isMain)
    return cell(row?.price)
  }

  function getFlatVal(countryCode, module) {
    const key = `${countryCode}|${module}`
    if (flatEdits[key] !== undefined) return flatEdits[key]
    const row = pricing.flatModulePricing.find((r) => r.countryCode === countryCode && r.module === module)
    return cell(row?.price)
  }

  function getVATVal(countryCode) {
    if (vatEdits[countryCode] !== undefined) return vatEdits[countryCode]
    const country = countries.find((c) => c.code === countryCode)
    return country ? (Number(country.vatRate || 0) * 100).toFixed(0) : ''
  }

  // Save branch pricing for all countries
  function handleSaveBranch() {
    const rows = []
    countries.forEach((c) => {
      PACKAGES.forEach((pkg) => {
        BRANCH_TYPES.forEach((bt) => {
          const price = getBranchVal(c.code, pkg, bt)
          if (price !== '' && price !== null) {
            rows.push({ countryCode: c.code, package: pkg, branchType: bt, price: Number(price), currency: c.currency })
          }
        })
      })
    })
    saveBranch.mutate(rows)
  }

  function handleSaveAccounting() {
    const rows = []
    countries.forEach((c) => {
      PACKAGES.forEach((pkg) => {
        ;[true, false].forEach((isMain) => {
          const price = getAccountingVal(c.code, pkg, isMain)
          if (price !== '' && price !== null) {
            rows.push({ countryCode: c.code, package: pkg, isMainLicense: isMain, price: Number(price), currency: c.currency })
          }
        })
      })
    })
    saveAccounting.mutate(rows)
  }

  function handleSaveFlat() {
    const rows = []
    countries.forEach((c) => {
      MODULES.forEach((mod) => {
        const price = getFlatVal(c.code, mod)
        if (price !== '' && price !== null) {
          rows.push({ countryCode: c.code, module: mod, price: Number(price), currency: c.currency })
        }
      })
    })
    saveFlat.mutate(rows)
  }

  function handleSaveVAT(countryCode) {
    const pct = getVATVal(countryCode)
    saveVAT.mutate({ countryCode, vatRate: Number(pct) / 100 })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pricing Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isAdmin ? 'Edit pricing tables below. Changes take effect immediately for new deals.' : 'Pricing is read-only for your role.'}
        </p>
      </div>

      {/* ── VAT Rates ──────────────────────────────────── */}
      <Section title="VAT Rates & Currencies">
        <div className="overflow-x-auto">
          <table className="text-sm w-auto">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Country</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Currency</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">VAT Rate (%)</th>
                {isAdmin && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {countries.map((c) => (
                <tr key={c.code} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500">{c.currency}</td>
                  <td className="px-4 py-2">
                    <PricingInput
                      value={getVATVal(c.code)}
                      onChange={(v) => setVatEdits((e) => ({ ...e, [c.code]: v }))}
                      disabled={!isAdmin}
                    />
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      <button onClick={() => handleSaveVAT(c.code)} className="text-xs text-indigo-600 hover:underline">
                        Save
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Branch Pricing ─────────────────────────────── */}
      <Section title="Branch Pricing (Monthly, per branch)">
        {countries.map((c) => (
          <div key={c.code} className="mb-6">
            <p className="text-xs font-semibold text-gray-700 mb-2">{c.name} ({c.currency})</p>
            <div className="overflow-x-auto">
              <table className="text-sm border border-gray-100 rounded-xl">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-36">Branch Type</th>
                    {PACKAGES.map((p) => <th key={p} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{p}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {BRANCH_TYPES.map((bt) => (
                    <tr key={bt} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 font-medium text-xs">{bt}</td>
                      {PACKAGES.map((pkg) => (
                        <td key={pkg} className="px-3 py-2">
                          <PricingInput
                            value={getBranchVal(c.code, pkg, bt)}
                            onChange={(v) => setBranchEdits((e) => ({ ...e, [`${c.code}|${pkg}|${bt}`]: v }))}
                            disabled={!isAdmin}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {isAdmin && (
          <button onClick={handleSaveBranch} disabled={saveBranch.isPending} className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saveBranch.isPending ? 'Saving…' : 'Save Branch Pricing'}
          </button>
        )}
      </Section>

      {/* ── Accounting Pricing ──────────────────────────── */}
      <Section title="Accounting Module Pricing (Monthly)">
        {countries.map((c) => (
          <div key={c.code} className="mb-6">
            <p className="text-xs font-semibold text-gray-700 mb-2">{c.name} ({c.currency})</p>
            <div className="overflow-x-auto">
              <table className="text-sm border border-gray-100 rounded-xl">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-40">Item</th>
                    {PACKAGES.map((p) => <th key={p} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{p}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[{ label: 'Main License', isMain: true }, { label: 'Extra Branch', isMain: false }].map(({ label, isMain }) => (
                    <tr key={label} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 font-medium text-xs">{label}</td>
                      {PACKAGES.map((pkg) => (
                        <td key={pkg} className="px-3 py-2">
                          <PricingInput
                            value={getAccountingVal(c.code, pkg, isMain)}
                            onChange={(v) => setAccountingEdits((e) => ({ ...e, [`${c.code}|${pkg}|${isMain}`]: v }))}
                            disabled={!isAdmin}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {isAdmin && (
          <button onClick={handleSaveAccounting} disabled={saveAccounting.isPending} className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saveAccounting.isPending ? 'Saving…' : 'Save Accounting Pricing'}
          </button>
        )}
      </Section>

      {/* ── Flat Module Pricing ──────────────────────────── */}
      <Section title="Flat Module Pricing (Monthly, package-independent)">
        <div className="overflow-x-auto">
          <table className="text-sm border border-gray-100 rounded-xl">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-40">Module</th>
                {countries.map((c) => <th key={c.code} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{c.name}<br /><span className="font-normal text-gray-400">{c.currency}</span></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MODULES.map((mod) => (
                <tr key={mod} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 font-medium text-xs">{mod === 'AIAgent' ? 'AI Agent (per user)' : mod}</td>
                  {countries.map((c) => (
                    <td key={c.code} className="px-3 py-2">
                      <PricingInput
                        value={getFlatVal(c.code, mod)}
                        onChange={(v) => setFlatEdits((e) => ({ ...e, [`${c.code}|${mod}`]: v }))}
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
          <button onClick={handleSaveFlat} disabled={saveFlat.isPending} className="mt-4 bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saveFlat.isPending ? 'Saving…' : 'Save Flat Module Pricing'}
          </button>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}
