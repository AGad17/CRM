'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'

const SOURCES = ['Foodics', 'EmployeeReferral', 'CustomerReferral', 'PartnerReferral', 'Website', 'AmbassadorReferral', 'DirectSales', 'Sonic']

function usd(v) { return `USD ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

function DaysBadge({ days }) {
  if (days <= 15) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">{days}d</span>
  if (days <= 30) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">{days}d</span>
  if (days <= 60) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">{days}d</span>
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{days}d</span>
}

function RowBar({ bucket }) {
  if (bucket === '30d') return <td className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 rounded-r" />
  if (bucket === '60d') return <td className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r" />
  return <td className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400 rounded-r" />
}

export default function RenewalPipelinePage() {
  const [country, setCountry] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [bucket, setBucket] = useState('')

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['renewal-pipeline', country, leadSource],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      if (leadSource) p.set('leadSource', leadSource)
      return fetch(`/api/analytics/renewal-pipeline?${p}`).then((r) => r.json())
    },
  })

  const filtered = bucket ? data.filter((r) => r.bucket === bucket) : data

  const count30 = data.filter((r) => r.bucket === '30d').length
  const count60 = data.filter((r) => r.bucket === '60d').length
  const count90 = data.filter((r) => r.bucket === '90d').length
  const mrr30 = data.filter((r) => r.bucket === '30d').reduce((s, r) => s + (r.mrr || 0), 0)
  const mrr60 = data.filter((r) => r.bucket === '60d').reduce((s, r) => s + (r.mrr || 0), 0)
  const mrr90 = data.filter((r) => r.bucket === '90d').reduce((s, r) => s + (r.mrr || 0), 0)
  const hasFilters = country || leadSource || bucket

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-14 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={country} onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={leadSource} onChange={(e) => setLeadSource(e.target.value)}
        >
          <option value="">All Lead Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/([A-Z])/g, ' $1').trim()}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 focus:border-[#5061F6]"
          value={bucket} onChange={(e) => setBucket(e.target.value)}
        >
          <option value="">All Buckets</option>
          <option value="30d">Expires in 30 days</option>
          <option value="60d">Expires in 31–60 days</option>
          <option value="90d">Expires in 61–90 days</option>
        </select>
        {hasFilters && (
          <button onClick={() => { setCountry(''); setLeadSource(''); setBucket('') }}
            className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-semibold underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Expiring ≤ 30 Days" value={count30} format="integer"
          subLabel={mrr30 > 0 ? `${usd(mrr30)} at risk` : 'No renewals'} accent="#ef4444" />
        <KPICard label="Expiring 31–60 Days" value={count60} format="integer"
          subLabel={mrr60 > 0 ? `${usd(mrr60)} at risk` : 'No renewals'} accent="#F4BF1D" />
        <KPICard label="Expiring 61–90 Days" value={count90} format="integer"
          subLabel={mrr90 > 0 ? `${usd(mrr90)} upcoming` : 'No renewals'} accent="#49B697" />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-14 text-center">
          <p className="text-sm text-gray-300 font-medium">No contracts expiring within 90 days.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
                {['Account', 'Country', 'Lead Source', 'Type', 'MRR', 'Contract Value', 'End Date', 'Days Left'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap first:sticky first:left-0 first:bg-transparent">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#F5F2FF]/40 transition-colors relative">
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap sticky left-0 bg-white">
                    <div className="flex items-center gap-2">
                      <span className={`w-1 h-8 rounded-full flex-shrink-0 ${r.bucket === '30d' ? 'bg-red-400' : r.bucket === '60d' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      {r.accountName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.countryName || r.country}</td>
                  <td className="px-4 py-3 text-gray-600">{r.leadSource?.replace(/([A-Z])/g, ' $1').trim()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F5F2FF] text-[#5061F6]">{r.type}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800 tabular-nums">{usd(r.mrr)}</td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">{usd(r.contractValue)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(r.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <DaysBadge days={r.daysLeft} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
