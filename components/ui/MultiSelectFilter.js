'use client'
import { useState, useEffect, useRef } from 'react'

/**
 * Generic multi-select checkbox filter dropdown — same UX as LeadSourceFilter.
 *
 * Props:
 *   label    — button label text (e.g. "Country", "Account Manager")
 *   options  — [{ value, label }]
 *   value    — string[] of selected values; empty array = all / no filter
 *   onChange — (string[]) => void
 */
export function MultiSelectFilter({ label, options = [], value = [], onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected   = value || []
  const isFiltered = selected.length > 0 && selected.length < options.length
  const isChecked  = (v) => selected.length === 0 || selected.includes(v)

  const toggle = (v) => {
    if (selected.length === 0) {
      onChange(options.map((o) => o.value).filter((o) => o !== v))
    } else if (selected.includes(v)) {
      const next = selected.filter((s) => s !== v)
      onChange(next.length === 0 ? [] : next)
    } else {
      const next = [...selected, v]
      onChange(next.length === options.length ? [] : next)
    }
  }

  const only = (v) => {
    onChange([v])
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          'text-sm border rounded-xl px-3 py-2 bg-white flex items-center gap-2',
          'focus:outline-none focus:ring-2 focus:ring-[#5061F6]/30 transition-colors',
          isFiltered
            ? 'border-[#5061F6] text-[#5061F6] bg-[#F5F2FF]'
            : 'border-gray-200 text-gray-700 hover:border-gray-300',
        ].join(' ')}
      >
        <span>{label}</span>
        {isFiltered && (
          <span className="bg-[#5061F6] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {selected.length}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 min-w-[200px] max-h-72 overflow-y-auto">
          {/* Header */}
          <div className="px-3 pb-2 mb-1 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {label}
            </span>
            <button
              type="button"
              className="text-[10px] font-semibold text-[#5061F6] hover:underline"
              onClick={() => onChange([])}
            >
              {isFiltered ? 'Select all' : 'All selected'}
            </button>
          </div>

          {/* Options */}
          {options.map(({ value: v, label: l }) => (
            <div
              key={v}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-[#F5F2FF] group"
            >
              <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked(v)}
                  onChange={() => toggle(v)}
                  className="w-3.5 h-3.5 accent-[#5061F6] cursor-pointer flex-shrink-0"
                />
                <span className="text-sm text-gray-700 group-hover:text-[#5061F6] select-none truncate">
                  {l}
                </span>
              </label>
              <button
                type="button"
                onClick={() => only(v)}
                className="ml-2 flex-shrink-0 text-[10px] font-semibold text-gray-300 hover:text-[#5061F6] opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Only ${l}`}
              >
                Only
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
