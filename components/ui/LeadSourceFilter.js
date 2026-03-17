'use client'
import { useState, useEffect, useRef } from 'react'

export const LEAD_SOURCES = [
  { value: 'Foodics',            label: 'Foodics' },
  { value: 'EmployeeReferral',   label: 'Employee Referral' },
  { value: 'CustomerReferral',   label: 'Customer Referral' },
  { value: 'PartnerReferral',    label: 'Partner Referral' },
  { value: 'Website',            label: 'Website' },
  { value: 'AmbassadorReferral', label: 'Ambassador Referral' },
  { value: 'DirectSales',        label: 'Direct Sales' },
  { value: 'Sonic',              label: 'Sonic' },
]

/**
 * Checkbox-based lead source filter dropdown.
 *
 * value:    string[]  — selected sources; empty array = all sources (no filter)
 * onChange: (string[]) => void
 */
export function LeadSourceFilter({ value = [], onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = value || []
  // "filtered" = some (but not all) sources are chosen
  const isFiltered = selected.length > 0 && selected.length < LEAD_SOURCES.length

  const isChecked = (src) => selected.length === 0 || selected.includes(src)

  const toggle = (src) => {
    if (selected.length === 0) {
      // Currently "all selected" — uncheck = select every source except this one
      onChange(LEAD_SOURCES.map((s) => s.value).filter((s) => s !== src))
    } else if (selected.includes(src)) {
      const next = selected.filter((s) => s !== src)
      // If nothing remains, reset to "all" (empty)
      onChange(next.length === 0 ? [] : next)
    } else {
      const next = [...selected, src]
      // If all are now chosen, normalise back to empty (= all)
      onChange(next.length === LEAD_SOURCES.length ? [] : next)
    }
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
        <span>Lead Sources</span>
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
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 min-w-[210px]">
          {/* Header row */}
          <div className="px-3 pb-2 mb-1 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Lead Sources
            </span>
            <button
              type="button"
              className="text-[10px] font-semibold text-[#5061F6] hover:underline"
              onClick={() => onChange([])}
            >
              {isFiltered ? 'Select all' : 'All selected'}
            </button>
          </div>

          {/* Checkboxes */}
          {LEAD_SOURCES.map(({ value: src, label }) => (
            <label
              key={src}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#F5F2FF] cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={isChecked(src)}
                onChange={() => toggle(src)}
                className="w-3.5 h-3.5 accent-[#5061F6] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-gray-700 group-hover:text-[#5061F6] select-none">
                {label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
