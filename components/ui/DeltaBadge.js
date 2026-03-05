'use client'

export function DeltaBadge({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-400">—</span>
  }

  const pct = (value * 100).toFixed(1)
  const positive = value >= 0

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}
