'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

export default function OutageBanner() {
  const { data: outages = [] } = useQuery({
    queryKey: ['active-outages'],
    queryFn: () =>
      fetch('/api/outages/active')
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    refetchInterval: 60 * 1000, // refresh every minute
    staleTime:       30 * 1000,
  })

  if (outages.length === 0) return null

  return (
    <div className="space-y-0">
      {outages.map(o => (
        <div
          key={o.id}
          className="w-full bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">⚠ ACTIVE OUTAGE</span>
            <span className="text-sm text-red-100">—</span>
            <span className="text-sm font-medium">{o.title}</span>
            <span className="text-xs text-red-200">· affecting all accounts</span>
          </div>
          <Link
            href={`/outages/${o.id}`}
            className="text-xs font-semibold text-white underline hover:text-red-100 flex-shrink-0"
          >
            View Details →
          </Link>
        </div>
      ))}
    </div>
  )
}
