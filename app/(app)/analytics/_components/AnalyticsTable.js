'use client'
import { DeltaBadge } from '@/components/ui/DeltaBadge'

function fmt(v, type) {
  if (v === null || v === undefined) return '—'
  if (type === 'currency') return `USD ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (type === 'percent') return `${(Number(v) * 100).toFixed(1)}%`
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const ROWS = [
  { key: 'newMRR',          label: 'New MRR Signed',    type: 'currency' },
  { key: 'renewalMRR',      label: 'Renewal MRR',       type: 'currency' },
  { key: 'expansionMRR',    label: 'Expansion MRR',     type: 'currency' },
  { key: 'totalMRRSigned',  label: 'Total MRR Signed',  type: 'currency', bold: true },
  { key: 'newAccounts',     label: 'New Accounts',      type: 'number' },
  { key: 'totalContracts',  label: 'Total Contracts',   type: 'number' },
  { key: 'churnedMRR',      label: 'Churned MRR',       type: 'currency' },
  { key: 'churnedAccounts', label: 'Churned Accounts',  type: 'number' },
  { key: 'contractValue',   label: 'Contract Value',    type: 'currency' },
  { key: 'netNewMRR',       label: 'Net New MRR',       type: 'currency', bold: true },
  { key: 'deltaTotalMRR',   label: 'Δ Total MRR',       type: 'delta' },
  { key: 'deltaNewAccounts',label: 'Δ New Accounts',    type: 'delta' },
  { key: 'deltaContractValue', label: 'Δ Contract Value', type: 'delta' },
  { key: 'nrr',             label: 'NRR',               type: 'percent' },
  { key: 'grr',             label: 'GRR',               type: 'percent' },
  { key: 'arr',             label: 'ARR',               type: 'currency' },
]

export function AnalyticsTable({ data, isLoading, periodLabel, exportFilename }) {
  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
  if (!data.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-14 text-center">
      <p className="text-sm text-gray-300 font-medium">No data available yet. Add contracts to see analytics.</p>
    </div>
  )

  function handleExport() {
    const header = [periodLabel, ...ROWS.map((r) => r.label)].join(',')
    const rows = data.map((col) => [col.period, ...ROWS.map((r) => col[r.key] ?? '')].join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = exportFilename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#5061F6] bg-white border border-[#5061F6]/20 rounded-lg hover:bg-[#F5F2FF] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" d="M12 3v13M7 11l5 5 5-5M3 21h18" />
          </svg>
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-widest sticky left-0 bg-transparent whitespace-nowrap">
                Metric
              </th>
              {data.map((col) => (
                <th key={col.period} className="px-5 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                  {col.period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ROWS.map((row) => (
              <tr key={row.key} className="hover:bg-[#F5F2FF]/40 transition-colors">
                <td className={`px-5 py-3 sticky left-0 bg-white whitespace-nowrap ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {row.bold && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#5061F6] mr-2 mb-px" />}
                  {row.label}
                </td>
                {data.map((col) => (
                  <td key={col.period} className="px-5 py-3 text-right">
                    {row.type === 'delta' ? (
                      <DeltaBadge value={col[row.key]} />
                    ) : (
                      <span className={row.bold ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                        {fmt(col[row.key], row.type)}
                      </span>
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
