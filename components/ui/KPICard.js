'use client'
import { DeltaBadge } from './DeltaBadge'

export function KPICard({ label, value, subLabel, delta, format = 'number', currency }) {
  const formatted = formatValue(value, format, currency)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{formatted}</p>
      <div className="flex items-center gap-2 mt-1">
        {delta !== undefined && delta !== null && <DeltaBadge value={delta} />}
        {subLabel && <span className="text-xs text-gray-400">{subLabel}</span>}
      </div>
    </div>
  )
}

function formatValue(value, format, currency) {
  if (value === null || value === undefined) return '—'
  switch (format) {
    case 'currency':
      return `${currency || 'USD'} ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
