'use client'
import { usePathname } from 'next/navigation'

const TITLES = {
  '/dashboard': 'CCO Dashboard',
  '/accounts': 'Accounts',
  '/contracts': 'Contracts',
  '/analytics/yoy': 'Year over Year',
  '/analytics/qoq': 'Quarter over Quarter',
  '/analytics/mom': 'Month over Month',
  '/segments': 'Segment Breakdown',
  '/churn': 'Churn Analysis',
  '/revenue-quality': 'Revenue Quality',
  '/cohorts': 'Cohort Retention',
}

export function Topbar() {
  const pathname = usePathname()
  const title = TITLES[pathname] || 'ShopBrain CRM'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
    </header>
  )
}
