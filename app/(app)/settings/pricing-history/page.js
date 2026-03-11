'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

const CHANNEL_LABELS = {
  Foodics:            'Foodics',
  DirectSales:        'Direct Sales',
  PartnerReferral:    'Partner Referral',
  CustomerReferral:   'Customer Referral',
  EmployeeReferral:   'Employee Referral',
  AmbassadorReferral: 'Ambassador Referral',
  Website:            'Website',
  Sonic:              'Sonic',
}

const MODULE_LABELS = {
  CentralKitchen:  'Central Kitchen',
  Warehouse:       'Warehouse',
  AccountingMain:  'Acct. Main',
  AccountingExtra: 'Acct. Extra Branch',
  Butchering:      'Butchering',
  AIAgent:         'AI Agent (per user)',
}

export default function PricingHistoryPage() {
  const [countryFilter, setCountryFilter]   = useState('')
  const [channelFilter, setChannelFilter]   = useState('')
  const [statusFilter, setStatusFilter]     = useState('all')  // 'all' | 'active' | 'historical'

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['pricing-history', countryFilter],
    queryFn: () => {
      const qs = countryFilter ? `?country=${encodeURIComponent(countryFilter)}` : ''
      return fetch(`/api/invoicing/pricing/history${qs}`).then((r) => r.json())
    },
    staleTime: 30_000,
  })

  // Derive distinct countries and channels from data
  const countries = [...new Set(history.map((r) => r.countryCode))].sort()
  const channels  = [...new Set(history.map((r) => r.salesChannel))].sort()

  // Apply local filters
  const filtered = history.filter((r) => {
    if (channelFilter && r.salesChannel !== channelFilter) return false
    if (statusFilter === 'active'    && !r.isActive) return false
    if (statusFilter === 'historical' && r.isActive) return false
    return true
  })

  function fmtDate(dt) {
    if (!dt) return '—'
    return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function fmtPrice(p, currency) {
    return `${currency} ${Number(p).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const inp = 'text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pricing History</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every change to pricing is recorded here. Active rows have no end date.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className={inp} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="">All Countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={inp} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="">All Channels</option>
          {channels.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c] || c}</option>)}
        </select>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[['all', 'All'], ['active', 'Active'], ['historical', 'Historical']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{filtered.length} rows</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Country</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Channel</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Package / Module</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Annual Price</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Effective From</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Effective To</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                      No pricing history found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id + row.type} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{row.countryCode}</td>
                      <td className="px-4 py-2.5 text-gray-700">{CHANNEL_LABELS[row.salesChannel] || row.salesChannel}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${row.type === 'Inventory' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {row.type === 'Inventory' ? row.label : (MODULE_LABELS[row.label] || row.label)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                        {fmtPrice(row.annualPrice, row.currency)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{fmtDate(row.effectiveFrom)}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{fmtDate(row.effectiveTo)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {row.isActive ? 'Active' : 'Historical'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
