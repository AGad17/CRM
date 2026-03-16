'use client'
import { useState, useMemo } from 'react'

export function DataTable({ columns, data, pageSize = 50, exportFilename }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sortCol) return data
    return [...data].sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortCol, sortDir])

  const pages   = Math.ceil(sorted.length / pageSize)
  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize)

  function handleSort(key) {
    if (sortCol === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(key); setSortDir('asc') }
    setPage(0)
  }

  function csvCell(val) {
    const s = val === null || val === undefined ? '' : String(val)
    // Wrap in quotes if the value contains commas, double-quotes, or newlines
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  function handleExport() {
    const exportCols = columns.filter((c) => c.exportable !== false && c.label !== '')
    const header = exportCols.map((c) => csvCell(c.label)).join(',')
    const rows = data.map((row) =>
      exportCols.map((c) => {
        const val = c.getValue ? c.getValue(row) : row[c.key]
        return csvCell(val)
      }).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = exportFilename || 'export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 font-medium">{sorted.length} {sorted.length === 1 ? 'row' : 'rows'}</p>
        {exportFilename && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#5061F6] bg-white border border-[#5061F6]/20 rounded-lg hover:bg-[#F5F2FF] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" d="M12 3v13M7 11l5 5 5-5M3 21h18" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to right, #F5F2FF, #FAFAFA)' }} className="border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap select-none ${col.sortable !== false ? 'cursor-pointer hover:text-[#5061F6] transition-colors' : ''}`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortCol === col.key && (
                      <span className="text-[#5061F6]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <p className="text-sm text-gray-300 font-medium">No data found</p>
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr key={i} className="hover:bg-[#F5F2FF]/40 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap text-sm">
                      {col.render ? col.render(row) : (
                        <span className={col.rtl ? 'rtl-text' : ''}>{row[col.key] ?? '—'}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-400">Page {page + 1} of {pages}</span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
