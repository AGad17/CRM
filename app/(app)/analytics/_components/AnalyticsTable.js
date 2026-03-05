'use client'
import { DeltaBadge } from '@/components/ui/DeltaBadge'

function fmt(v, type) {
  if (v === null || v === undefined) return '—'
  if (type === 'currency') return `SAR ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (type === 'percent') return `${(Number(v) * 100).toFixed(1)}%`
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const ROWS = [
  { key: 'newMRR', label: 'New MRR Signed', type: 'currency' },
  { key: 'renewalMRR', label: 'Renewal MRR', type: 'currency' },
  { key: 'expansionMRR', label: 'Expansion MRR', type: 'currency' },
  { key: 'totalMRRSigned', label: 'Total MRR Signed', type: 'currency', bold: true },
  { key: 'newAccounts', label: 'New Accounts', type: 'number' },
  { key: 'totalContracts', label: 'Total Contracts', type: 'number' },
  { key: 'churnedMRR', label: 'Churned MRR', type: 'currency' },
  { key: 'churnedAccounts', label: 'Churned Accounts', type: 'number' },
  { key: 'contractValue', label: 'Contract Value', type: 'currency' },
  { key: 'netNewMRR', label: 'Net New MRR', type: 'currency', bold: true },
  { key: 'deltaTotalMRR', label: 'Δ Total MRR', type: 'delta' },
  { key: 'deltaNewAccounts', label: 'Δ New Accounts', type: 'delta' },
  { key: 'deltaContractValue', label: 'Δ Contract Value', type: 'delta' },
  { key: 'nrr', label: 'NRR', type: 'percent' },
  { key: 'grr', label: 'GRR', type: 'percent' },
  { key: 'arr', label: 'ARR', type: 'currency' },
]

export function AnalyticsTable({ data, isLoading, periodLabel, exportFilename }) {
  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
  if (!data.length) return <div className="text-sm text-gray-400 text-center py-16">No data available yet. Add contracts to see analytics.</div>

  function handleExport() {
    const header = [periodLabel, ...ROWS.map((r) => r.label)].join(',')
    const rows = data.map((col) => [col.period, ...ROWS.map((r) => col[r.key] ?? '')].join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = exportFilename
    a.click()
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={handleExport} className="text-xs text-gray-500 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50">↓ Export CSV</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50">Metric</th>
              {data.map((col) => (
                <th key={col.period} className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{col.period}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ROWS.map((row) => (
              <tr key={row.key} className="hover:bg-gray-50">
                <td className={`px-5 py-3 sticky left-0 bg-white whitespace-nowrap ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</td>
                {data.map((col) => (
                  <td key={col.period} className="px-5 py-3 text-right">
                    {row.type === 'delta' ? (
                      <DeltaBadge value={col[row.key]} />
                    ) : (
                      <span className={row.bold ? 'font-semibold text-gray-900' : 'text-gray-700'}>{fmt(col[row.key], row.type)}</span>
                    )}
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
