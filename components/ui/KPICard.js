'use client'
import { DeltaBadge } from './DeltaBadge'

function formatValue(value, format, currency) {
  if (value === null || value === undefined) return '—'
  switch (format) {
    case 'currency':
      return `${currency || 'USD'} ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    case 'percent':
      return `${(Number(value) * 100).toFixed(1)}%`
    case 'integer':
      return Number(value).toLocaleString('en-US')
    default:
      return typeof value === 'number'
        ? value % 1 === 0 ? value.toLocaleString('en-US') : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : String(value)
  }
}

export function KPICard({ label, value, subLabel, delta, format = 'number', currency, accent }) {
  const formatted = formatValue(value, format, currency)
  const bar = accent || '#5061F6'

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 px-5 py-4 flex flex-col gap-0.5 shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: bar }} />

      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest leading-none pl-1">
        {label}
      </p>
      <p className="text-2xl font-bold leading-tight mt-1 pl-1" style={{ color: '#1a1a2e' }}>
        {formatted}
      </p>
      {(delta !== undefined && delta !== null || subLabel) && (
        <div className="flex items-center gap-2 mt-0.5 pl-1">
          {delta !== undefined && delta !== null && <DeltaBadge value={delta} />}
          {subLabel && <span className="text-[11px] text-gray-400">{subLabel}</span>}
        </div>
      )}
    </div>
  )
}
