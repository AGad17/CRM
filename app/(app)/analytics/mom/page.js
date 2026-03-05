'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnalyticsTable } from '../_components/AnalyticsTable'

export default function MoMPage() {
  const [country, setCountry] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetch('/api/countries').then((r) => r.json()),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['analytics-mom', country],
    queryFn: () => {
      const p = new URLSearchParams()
      if (country) p.set('country', country)
      return fetch(`/api/analytics/mom?${p}`).then((r) => r.json())
    },
  })

  // period format: "2023-01" — extract year for range filter
  const years = useMemo(() => [...new Set(data.map((r) => Number(r.period.split('-')[0])))].sort(), [data])

  const filtered = useMemo(() => data.filter((r) => {
    const y = Number(r.period.split('-')[0])
    if (yearFrom && y < Number(yearFrom)) return false
    if (yearTo && y > Number(yearTo)) return false
    return true
  }), [data, yearFrom, yearTo])

  const hasFilters = country || yearFrom || yearTo

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All Countries</option>
          {countries.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)}>
          <option value="">From Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" value={yearTo} onChange={(e) => setYearTo(e.target.value)}>
          <option value="">To Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {hasFilters && <button className="text-xs text-gray-500 hover:text-gray-700 underline" onClick={() => { setCountry(''); setYearFrom(''); setYearTo('') }}>Clear filters</button>}
      </div>
      <AnalyticsTable data={filtered} isLoading={isLoading} periodLabel="Month" exportFilename="mom.csv" />
    </div>
  )
}
