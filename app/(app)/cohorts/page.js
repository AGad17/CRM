'use client'
import { useQuery } from '@tanstack/react-query'

function pct(v) {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function cellColor(v) {
  if (v === null || v === undefined) return 'bg-gray-50 text-gray-300'
  if (v < 0.7) return 'bg-red-100 text-red-700 font-semibold'
  if (v < 0.9) return 'bg-amber-100 text-amber-700 font-semibold'
  return 'bg-emerald-50 text-emerald-700'
}

export default function CohortsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['cohorts'],
    queryFn: () => fetch('/api/analytics/cohorts').then((r) => r.json()),
  })

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
  if (!data.length) return <div className="text-sm text-gray-400 text-center py-16">No cohort data available yet.</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-300" /> &lt;70% retention</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-200 border border-amber-300" /> &lt;90% retention</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> ≥90% retention</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50">Cohort</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Initial MRR</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Accounts</th>
              {['Q+1', 'Q+2', 'Q+3', 'Q+4', 'Q+5', 'Q+6'].map((q) => (
                <th key={q} className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">{q}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row) => (
              <tr key={row.cohort} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white">{row.cohort}</td>
                <td className="px-4 py-3 text-right text-gray-700">SAR {Number(row.initialMRR || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right text-gray-700">{row.initialAccounts}</td>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <td key={i} className={`px-4 py-3 text-center text-xs rounded ${cellColor(row[`q${i}`])}`}>
                    {pct(row[`q${i}`])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
