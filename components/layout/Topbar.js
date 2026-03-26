'use client'
import { usePathname } from 'next/navigation'
import { useSidebar } from './SidebarContext'
import { NotificationBell } from './NotificationBell'

const TITLES = {
  '/dashboard':                'CCO Dashboard',
  '/accounts':                 'Accounts',
  '/contracts':                'Contracts',
  '/analytics/yoy':            'Year over Year',
  '/analytics/qoq':            'Quarter over Quarter',
  '/analytics/mom':            'Month over Month',
  '/segments':                 'Segment Breakdown',
  '/churn':                    'Churn Analysis',
  '/revenue-quality':          'Revenue Quality',
  '/cohorts':                  'Cohort Retention',
  '/renewal-pipeline':         'Renewal Pipeline',
  '/mrr-waterfall':            'MRR Waterfall',
  '/account-health':           'Account Health Score',
  '/lead-source-analysis':     'Lead Source Analysis',
  '/win-loss':                 'Win / Loss Analysis',
  '/nrr-breakdown':            'NRR Breakdown',
  '/pipeline':                 'Sales Pipeline',
  '/pipeline/analytics':       'Pipeline Analytics',
  '/invoicing/sales-log':      'Sales Log',
  '/invoicing/invoices':       'Invoices',
  '/invoicing/ar-report':      'AR Report',
  '/invoicing/deal-calculator':'Deal Calculator',
  '/invoicing/pricing':        'Pricing Config',
  '/onboarding':               'Customer Journey',
  '/surveys':                  'CSAT & NPS',
  '/settings':                 'Settings — General',
  '/settings/pricing':         'Pricing Config',
  '/settings/pricing-history': 'Pricing History',
  '/notifications':            'Notifications',
}

function IcMenu() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function Topbar() {
  const pathname = usePathname()
  const { toggleMobile } = useSidebar()

  // Match exact, then prefix
  const title =
    TITLES[pathname] ||
    Object.entries(TITLES).find(([k]) => pathname.startsWith(k + '/') && k !== '/')?.[1] ||
    'ShopBrain CRM'

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 sticky top-0 z-10 shadow-sm">
      {/* Hamburger — mobile only */}
      <button
        onClick={toggleMobile}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
        aria-label="Open navigation"
      >
        <IcMenu />
      </button>

      {/* Page title */}
      <h1
        className="text-base font-semibold text-gray-900 flex-1 truncate"
        style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}
      >
        {title}
      </h1>

      {/* Notifications */}
      <NotificationBell />

      {/* Brand dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#5061F6' }} />
    </header>
  )
}
