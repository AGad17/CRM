'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import clsx from 'clsx'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/accounts', label: 'Accounts', icon: '🏢' },
  { href: '/contracts', label: 'Contracts', icon: '📄' },
  {
    label: 'Analytics',
    icon: '📈',
    children: [
      { href: '/analytics/yoy', label: 'Year over Year' },
      { href: '/analytics/qoq', label: 'Quarter over Quarter' },
      { href: '/analytics/mom', label: 'Month over Month' },
    ],
  },
  { href: '/segments', label: 'Segments', icon: '🌍' },
  { href: '/churn', label: 'Churn Analysis', icon: '📉' },
  { href: '/revenue-quality', label: 'Revenue Quality', icon: '💎' },
  { href: '/cohorts', label: 'Cohort Retention', icon: '🔄' },
  {
    label: 'Sales',
    icon: '🎯',
    children: [
      { href: '/pipeline',           label: 'Pipeline'  },
      { href: '/pipeline/analytics', label: 'Analytics' },
    ],
  },
  {
    label: 'Invoicing',
    icon: '🧾',
    children: [
      { href: '/invoicing/sales-log',  label: 'Sales Log' },
      { href: '/invoicing/invoices',   label: 'Invoices' },
      { href: '/invoicing/ar-report',  label: 'AR Report' },
    ],
  },
  {
    label: 'Operations',
    icon: '🚀',
    children: [
      { href: '/onboarding', label: 'Customer Journey' },
      { href: '/surveys',    label: 'CSAT & NPS' },
    ],
  },
  {
    label: 'Settings',
    icon: '⚙️',
    children: [
      { href: '/settings',                 label: 'General' },
      { href: '/settings/pricing',         label: 'Pricing Config' },
      { href: '/settings/pricing-history', label: 'Pricing History' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-gray-900 flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <p className="text-white font-bold text-lg tracking-tight">ShopBrain</p>
        <p className="text-gray-400 text-xs mt-0.5">CRM</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {NAV.map((item) => {
          if (item.children) {
            const isParentActive = item.children.some((c) => pathname.startsWith(c.href))
            return (
              <div key={item.label}>
                <div className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium',
                  isParentActive ? 'text-white' : 'text-gray-400'
                )}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <div className="ml-4 space-y-0.5">
                  {item.children.map((child) => (
                    <NavItem key={child.href} href={child.href} label={child.label} pathname={pathname} sub />
                  ))}
                </div>
              </div>
            )
          }
          return <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} />
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-gray-300 text-xs font-medium truncate">{session?.user?.name || session?.user?.email}</p>
        <p className="text-gray-500 text-xs mt-0.5">{session?.user?.role?.replace('_', ' ')}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out →
        </button>
      </div>
    </aside>
  )
}

function NavItem({ href, label, icon, pathname, sub }) {
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        sub ? 'ml-2' : '',
        active
          ? 'bg-indigo-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      )}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </Link>
  )
}
