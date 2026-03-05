'use client'

const variants = {
  Active: 'bg-emerald-100 text-emerald-700',
  Churned: 'bg-red-100 text-red-600',
  Inactive: 'bg-gray-100 text-gray-500',
  New: 'bg-blue-100 text-blue-700',
  Renewal: 'bg-purple-100 text-purple-700',
  Expansion: 'bg-amber-100 text-amber-700',
}

export function Badge({ value }) {
  const cls = variants[value] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {value}
    </span>
  )
}
