'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const VIEWS = [
  { key: 'foodicsAR',      label: 'Foodics AR' },
  { key: 'foodicsHistory', label: 'Foodics History' },
  { key: 'directAR',       label: 'Direct AR' },
  { key: 'fullHistory',    label: 'Full History' },
]

const STATUS_OPTIONS = ['Pending', 'Eligible', 'Collected']

function fmt(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function exportCSV(columns, rows, filename) {
  const header = columns.map((c) => `"${c.label}"`).join(',')
  const body   = rows.map((row) =>
    columns.map((c) => {
      const v = row[c.key]
      if (v == null) return '""'
      // Format date fields
      if (c.key.toLowerCase().includes('date')) {
        try { return `"${new Date(v).toLocaleDateString()}"` } catch { return `"${v}"` }
      }
      // Numeric fields — no quotes
      if (typeof v === 'number') return String(v)
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  ).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function StatusCell({ invoice, onUpdate }) {
  return (
    <select
      value={invoice.status}
      onChange={(e) => onUpdate(invoice.id, { status: e.target.value })}
      className={`text-xs border rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
        invoice.status === 'Collected' ? 'bg-green-50 border-green-200 text-green-700' :
        invoice.status === 'Eligible'  ? 'bg-blue-50 border-blue-200 text-blue-700' :
        'bg-yellow-50 border-yellow-200 text-yellow-700'
      }`}
    >
      {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
    </select>
  )
}

function DateCell({ value, invoiceId, field, onUpdate }) {
  return (
    <input
      type="date"
      value={value ? new Date(value).toISOString().slice(0, 10) : ''}
      onChange={(e) => onUpdate(invoiceId, { [field]: e.target.value || null })}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
    />
  )
}

function FoodicsNumCell({ value, invoiceId, onUpdate }) {
  const [local, setLocal] = useState(value || '')
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onUpdate(invoiceId, { foodicsInvoiceNumber: local || null })}
      placeholder="Enter #"
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-28 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
    />
  )
}

export default function InvoicesPage() {
  const qc = useQueryClient()
  const [activeView, setActiveView] = useState('foodicsAR')
  const [search, setSearch] = useState('')

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoicing-invoices', activeView],
    queryFn: () => fetch(`/api/invoicing/invoices?view=${activeView}`).then((r) => r.json()),
  })

  const patch = useMutation({
    mutationFn: ({ id, data }) =>
      fetch(`/api/invoicing/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries(['invoicing-invoices', activeView])
      qc.invalidateQueries(['invoicing-ar-report'])
    },
  })

  function handleUpdate(id, data) {
    patch.mutate({ id, data })
  }

  const today = new Date()

  const displayed = useMemo(() => {
    if (!search.trim()) return invoices
    const q = search.toLowerCase()
    return invoices.filter(
      (i) => i.invoiceNumber?.toLowerCase().includes(q) || i.accountName?.toLowerCase().includes(q),
    )
  }, [invoices, search])

  // Column definitions per view
  const columns = useMemo(() => {
    if (activeView === 'foodicsAR') {
      return [
        { key: 'invoiceNumber', label: 'SB Invoice #',    render: (r) => <span className="font-mono text-xs font-semibold">{r.invoiceNumber}</span> },
        { key: 'accountName',   label: 'Account',         render: (r) => <span className="font-medium">{r.accountName}</span> },
        { key: 'foodicsInvoiceNumber', label: 'Foodics Invoice #', sortable: false, render: (r) => <FoodicsNumCell value={r.foodicsInvoiceNumber} invoiceId={r.id} onUpdate={handleUpdate} /> },
        { key: 'invoiceDate',   label: 'Invoice Date',    render: (r) => new Date(r.invoiceDate).toLocaleDateString() },
        { key: 'amountInclVAT', label: 'Amount (incl. VAT)', render: (r) => `${r.countryCode} ${fmt(r.amountInclVAT)}` },
        { key: 'eligibleCollectionDate', label: 'Eligible Date', render: (r) => r.eligibleCollectionDate ? new Date(r.eligibleCollectionDate).toLocaleDateString() : '—' },
        { key: 'status',        label: 'Status', sortable: false, render: (r) => <StatusCell invoice={r} onUpdate={handleUpdate} /> },
        { key: 'daysUntilEligible', label: 'Days Until Eligible', render: (r) => r.daysUntilEligible != null ? (r.daysUntilEligible < 0 ? <span className="text-red-600 font-semibold">{r.daysUntilEligible}d</span> : `${r.daysUntilEligible}d`) : '—' },
      ]
    }
    if (activeView === 'foodicsHistory') {
      return [
        { key: 'invoiceNumber', label: 'SB Invoice #',    render: (r) => <span className="font-mono text-xs font-semibold">{r.invoiceNumber}</span> },
        { key: 'accountName',   label: 'Account',         render: (r) => <span className="font-medium">{r.accountName}</span> },
        { key: 'foodicsInvoiceNumber', label: 'Foodics Invoice #', sortable: false, render: (r) => <FoodicsNumCell value={r.foodicsInvoiceNumber} invoiceId={r.id} onUpdate={handleUpdate} /> },
        { key: 'invoiceDate',   label: 'Invoice Date',    render: (r) => new Date(r.invoiceDate).toLocaleDateString() },
        { key: 'amountInclVAT', label: 'Amount (incl. VAT)', render: (r) => `${r.countryCode} ${fmt(r.amountInclVAT)}` },
        { key: 'collectionDate', label: 'Collection Date', sortable: false, render: (r) => <DateCell value={r.collectionDate} invoiceId={r.id} field="collectionDate" onUpdate={handleUpdate} /> },
        { key: 'collectionCycleDays', label: 'Collection Cycle', render: (r) => r.collectionCycleDays != null ? `${r.collectionCycleDays}d` : '—' },
        { key: 'countryCode',   label: 'Country' },
      ]
    }
    if (activeView === 'directAR') {
      return [
        { key: 'invoiceNumber', label: 'SB Invoice #',    render: (r) => <span className="font-mono text-xs font-semibold">{r.invoiceNumber}</span> },
        { key: 'accountName',   label: 'Account',         render: (r) => <span className="font-medium">{r.accountName}</span> },
        { key: 'posSystem',     label: 'POS',             render: (r) => r.posSystem },
        { key: 'invoiceDate',   label: 'Invoice Date',    render: (r) => new Date(r.invoiceDate).toLocaleDateString() },
        { key: 'amountInclVAT', label: 'Amount (incl. VAT)', render: (r) => `${r.countryCode} ${fmt(r.amountInclVAT)}` },
        { key: 'collectionDate', label: 'Collection Date', sortable: false, render: (r) => <DateCell value={r.collectionDate} invoiceId={r.id} field="collectionDate" onUpdate={handleUpdate} /> },
        { key: 'status',        label: 'Status', sortable: false, render: (r) => <StatusCell invoice={r} onUpdate={handleUpdate} /> },
      ]
    }
    // fullHistory
    return [
      { key: 'invoiceNumber', label: 'SB Invoice #',    render: (r) => <span className="font-mono text-xs font-semibold">{r.invoiceNumber}</span> },
      { key: 'accountName',   label: 'Account',         render: (r) => <span className="font-medium">{r.accountName}</span> },
      { key: 'posSystem',     label: 'POS',             render: (r) => r.posSystem },
      { key: 'invoiceDate',   label: 'Invoice Date',    render: (r) => new Date(r.invoiceDate).toLocaleDateString() },
      { key: 'amountInclVAT', label: 'Amount (incl. VAT)', render: (r) => `${r.countryCode} ${fmt(r.amountInclVAT)}` },
      { key: 'collectionDate', label: 'Collection Date', render: (r) => r.collectionDate ? new Date(r.collectionDate).toLocaleDateString() : '—' },
      { key: 'collectionCycleDays', label: 'Collection Cycle', render: (r) => r.collectionCycleDays != null ? `${r.collectionCycleDays}d` : '—' },
      { key: 'countryCode',   label: 'Country' },
    ]
  }, [activeView])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track and manage AR collection across all channels.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => { setActiveView(v.key); setSearch('') }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeView === v.key
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Search + Export */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by invoice # or account…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white w-64"
        />
        <span className="text-xs text-gray-400">{displayed.length} records</span>
        <button
          onClick={() => exportCSV(columns, displayed, `invoices-${activeView}.csv`)}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#5061F6] border border-[#5061F6] rounded-xl px-3 py-2 hover:bg-[#5061F6] hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-400">
                    No invoices found
                  </td>
                </tr>
              ) : (
                displayed.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      row.isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {col.render ? col.render(row) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
