'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/ui/KPICard'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ARSection({ title, data, color }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Invoiced"  value={fmt(data.total)}       subLabel={`${data.countPending + data.countEligible + data.countCollected} invoices`} />
        <KPICard label="Pending"         value={fmt(data.pending)}      subLabel={`${data.countPending} invoices`} />
        <KPICard label="Eligible"        value={fmt(data.eligible)}     subLabel={`${data.countEligible} invoices`} />
        <KPICard label="Collected"       value={fmt(data.collected)}    subLabel={`${data.countCollected} invoices`} />
        <KPICard label="Outstanding"     value={fmt(data.outstanding)}  subLabel="Pending + Eligible" />
        <KPICard label="Overdue"         value={fmt(data.overdue)}      subLabel={`${data.countOverdue} overdue`} />
      </div>
    </div>
  )
}

const BUCKET_CONFIG = {
  'current': { label: 'Current',   color: 'bg-gray-100 text-gray-600' },
  '0-30':    { label: '0–30 days', color: 'bg-yellow-100 text-yellow-700' },
  '30-60':   { label: '30–60 days',color: 'bg-orange-100 text-orange-700' },
  '60-90':   { label: '60–90 days',color: 'bg-red-100 text-red-700' },
  '90+':     { label: '90+ days',  color: 'bg-red-200 text-red-800' },
}

function exportCsv(rows, filename) {
  function cell(v) {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const headers = ['Account', 'Invoice #', 'POS', 'Status', 'Eligible Date', 'Age Bucket', 'Days Overdue', 'Amount (incl. VAT)']
  const csvRows = rows.map((r) => [
    r.accountName, r.invoiceNumber, r.posSystem, r.status,
    r.eligibleCollectionDate ? new Date(r.eligibleCollectionDate).toLocaleDateString('en-GB') : '',
    r.ageBucket, r.daysOverdue ?? '', Number(r.amountInclVAT || 0).toFixed(2),
  ].map(cell).join(','))
  const csv = [headers.map(cell).join(','), ...csvRows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  URL.revokeObjectURL(a.href)
}

export default function ARReportPage() {
  const [bucket, setBucket]   = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [search, setSearch]   = useState('')

  const { data: report, isLoading } = useQuery({
    queryKey: ['invoicing-ar-report'],
    queryFn: () => fetch('/api/invoicing/ar-report').then((r) => r.json()),
    refetchInterval: 30_000,
  })

  const agingRows = report?.agingRows || []

  const filtered = agingRows.filter((r) => {
    if (bucket    && r.ageBucket !== bucket) return false
    if (posFilter && r.posSystem !== posFilter) return false
    if (search    && !r.accountName.toLowerCase().includes(search.toLowerCase()) &&
        !r.invoiceNumber.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Bucket summary counts
  const bucketCounts = {}
  for (const r of agingRows) {
    bucketCounts[r.ageBucket] = (bucketCounts[r.ageBucket] || 0) + 1
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AR Report</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live accounts receivable summary across all channels.</p>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="space-y-8">
            <ARSection title="All Channels"             data={report?.all}     color="bg-indigo-500" />
            <ARSection title="Foodics"                  data={report?.foodics} color="bg-emerald-500" />
            <ARSection title="Direct (Geidea / Sonic)"  data={report?.direct}  color="bg-orange-500" />
          </div>

          {/* Aging Drill-Down */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Outstanding Invoices</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{filtered.length} of {agingRows.length}</span>
                {filtered.length > 0 && (
                  <button
                    onClick={() => exportCsv(filtered, 'ar-report.csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#5061F6] bg-white border border-[#5061F6]/20 rounded-lg hover:bg-[#F5F2FF] transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                      <path strokeLinecap="round" d="M12 3v13M7 11l5 5 5-5M3 21h18" />
                    </svg>
                    Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* Bucket filter chips */}
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setBucket('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!bucket ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All ({agingRows.length})
              </button>
              {Object.entries(BUCKET_CONFIG).map(([key, cfg]) => {
                const count = bucketCounts[key] || 0
                if (!count) return null
                return (
                  <button key={key}
                    onClick={() => setBucket(bucket === key ? '' : key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${bucket === key ? 'bg-indigo-600 text-white' : cfg.color + ' hover:opacity-80'}`}
                  >
                    {cfg.label} ({count})
                  </button>
                )
              })}
              <div className="flex gap-2 ml-auto">
                <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">All POS</option>
                  <option value="Foodics">Foodics</option>
                  <option value="Geidea">Geidea</option>
                  <option value="Sonic">Sonic</option>
                </select>
                <input type="text" placeholder="Search account…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44" />
              </div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
                No outstanding invoices match the current filter.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">POS</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Eligible Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Age</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount (incl. VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((row) => {
                      const bucketCfg = BUCKET_CONFIG[row.ageBucket] || BUCKET_CONFIG['current']
                      return (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {row.accountId ? (
                              <a href={`/accounts/${row.accountId}`} className="hover:text-indigo-600 hover:underline">
                                {row.accountName}
                              </a>
                            ) : row.accountName}
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.invoiceNumber}</td>
                          <td className="px-4 py-3 text-gray-500">{row.posSystem}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.status === 'Eligible' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {row.eligibleCollectionDate
                              ? new Date(row.eligibleCollectionDate).toLocaleDateString('en-GB')
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${bucketCfg.color}`}>
                              {row.daysOverdue > 0 ? `${row.daysOverdue}d overdue` : bucketCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {fmt(row.amountInclVAT)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-gray-500">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {fmt(filtered.reduce((s, r) => s + r.amountInclVAT, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
