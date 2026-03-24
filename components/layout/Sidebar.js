'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useSidebar } from './SidebarContext'
import clsx from 'clsx'

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IcDashboard() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IcAccounts() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 21V11H3M21 21V11h-3M9 21V5l6-3v19" />
    </svg>
  )
}
function IcAnalytics() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  )
}
function IcSales() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IcInvoicing() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path strokeLinecap="round" d="M14 2v6h6M8 12h8M8 16h5" />
    </svg>
  )
}
function IcOperations() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}
function IcSettings() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}
function IcChevron({ open }) {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      className={`transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  )
}
function IcCollapseArrows({ collapsed }) {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
    </svg>
  )
}
function IcSignOut() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

// ─── Navigation map ───────────────────────────────────────────────────────────

const NAV = [
  { label: 'Dashboard', icon: IcDashboard, href: '/dashboard' },
  {
    label: 'Accounts', icon: IcAccounts,
    children: [
      { href: '/accounts',  label: 'All Accounts' },
      { href: '/contracts', label: 'Contracts'    },
    ],
  },
  {
    label: 'Analytics', icon: IcAnalytics,
    children: [
      { href: '/analytics/yoy',        label: 'Year over Year'        },
      { href: '/analytics/qoq',        label: 'Quarter over Quarter'  },
      { href: '/analytics/mom',        label: 'Month over Month'      },
      { href: '/segments',             label: 'Segments'              },
      { href: '/churn',                label: 'Churn Analysis'        },
      { href: '/revenue-quality',      label: 'Revenue Quality'       },
      { href: '/cohorts',              label: 'Cohort Retention'      },
      { href: '/renewal-pipeline',     label: 'Renewal Pipeline'      },
      { href: '/mrr-waterfall',        label: 'MRR Waterfall'         },
      { href: '/account-health',       label: 'Account Health'        },
      { href: '/cs-performance',       label: 'CS Performance'        },
      { href: '/lead-source-analysis', label: 'Lead Source Analysis'  },
      { href: '/win-loss',             label: 'Win / Loss'            },
      { href: '/nrr-breakdown',        label: 'NRR Breakdown'         },
    ],
  },
  {
    label: 'Sales', icon: IcSales,
    children: [
      { href: '/pipeline',           label: 'Pipeline'  },
      { href: '/pipeline/analytics', label: 'Analytics' },
    ],
  },
  {
    label: 'Invoicing', icon: IcInvoicing,
    children: [
      { href: '/invoicing/sales-log', label: 'Sales Log' },
      { href: '/invoicing/invoices',  label: 'Invoices'  },
      { href: '/invoicing/ar-report', label: 'AR Report' },
    ],
  },
  {
    label: 'Operations', icon: IcOperations,
    children: [
      { href: '/onboarding',       label: 'Customer Journey' },
      { href: '/surveys',          label: 'CSAT & NPS'       },
      { href: '/engagement-logs',  label: 'Engagement Logs'  },
    ],
  },
  {
    label: 'Settings', icon: IcSettings,
    children: [
      { href: '/settings',                 label: 'General'         },
      { href: '/settings/pricing',         label: 'Pricing Config'  },
      { href: '/settings/pricing-history', label: 'Pricing History' },
    ],
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar()

  // Auto-open the group that contains the active route
  const [openGroups, setOpenGroups] = useState(() =>
    NAV
      .filter(item => item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')))
      .map(item => item.label)
  )

  // Keep active group open when route changes
  useEffect(() => {
    NAV.forEach(item => {
      if (item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))) {
        setOpenGroups(prev => prev.includes(item.label) ? prev : [...prev, item.label])
      }
    })
  }, [pathname])

  const toggleGroup = (label) =>
    setOpenGroups(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])

  const initials = () => {
    const name = session?.user?.name || session?.user?.email || 'U'
    return name.split(/[\s@]/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-0 h-full z-40 flex flex-col select-none',
          'transition-[width,transform] duration-300 ease-in-out overflow-hidden',
          // Desktop width (both written as complete class names for Tailwind scanning)
          collapsed ? 'lg:w-16' : 'lg:w-64',
          // Mobile: always 256 px, slide in/out
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ background: 'linear-gradient(175deg, #2E1065 0%, #1A0840 100%)' }}
      >
        {/* ── Logo + collapse button ── */}
        <div className={clsx(
          'flex items-center border-b border-white/10 flex-shrink-0',
          'h-14',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-base tracking-tight leading-none" style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                ShopBrain
              </p>
              <p className="text-[#C2B4FB] text-[10px] mt-0.5 font-semibold tracking-widest uppercase">
                CRM Platform
              </p>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IcCollapseArrows collapsed={collapsed} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden" aria-label="Main navigation">
          <ul className="space-y-0.5 px-2">
            {NAV.map((item) => {
              const Icon = item.icon

              // ── Direct link (Dashboard) ──
              if (item.href && !item.children) {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      title={collapsed ? item.label : undefined}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                        active
                          ? 'bg-[#5061F6] text-white shadow-lg shadow-[#5061F6]/30'
                          : 'text-white/60 hover:text-white hover:bg-white/10',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <span className="flex-shrink-0"><Icon /></span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                )
              }

              // ── Accordion group ──
              const isGroupActive = item.children.some(
                c => pathname === c.href || pathname.startsWith(c.href + '/')
              )
              const isOpen = !collapsed && openGroups.includes(item.label)

              return (
                <li key={item.label}>
                  <button
                    onClick={() => { if (!collapsed) toggleGroup(item.label) }}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      isGroupActive
                        ? 'text-white bg-white/10'
                        : 'text-white/60 hover:text-white hover:bg-white/10',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <span className="flex-shrink-0"><Icon /></span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        <IcChevron open={isOpen} />
                      </>
                    )}
                  </button>

                  {/* Children — animated with max-height */}
                  {!collapsed && (
                    <div className={clsx(
                      'overflow-hidden transition-all duration-200 ease-in-out',
                      isOpen ? 'max-h-[600px] opacity-100 mt-0.5' : 'max-h-0 opacity-0',
                    )}>
                      <ul className="ml-4 pl-3 border-l border-white/[0.08] space-y-0.5 pb-1">
                        {item.children.map(child => {
                          const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={closeMobile}
                                className={clsx(
                                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                                  childActive
                                    ? 'bg-[#5061F6] text-white font-semibold shadow-md shadow-[#5061F6]/25'
                                    : 'text-white/50 hover:text-white hover:bg-white/10',
                                )}
                              >
                                <span className={clsx(
                                  'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                                  childActive ? 'bg-white' : 'bg-white/25',
                                )} />
                                {child.label}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ── User footer ── */}
        <div className={clsx(
          'border-t border-white/10 flex-shrink-0',
          collapsed ? 'p-3' : 'px-4 py-3',
        )}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#5061F6] flex items-center justify-center text-white text-xs font-bold">
                {initials()}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                className="text-white/30 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <IcSignOut />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#5061F6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate leading-tight">
                  {session?.user?.name || session?.user?.email}
                </p>
                <p className="text-white/40 text-[11px] mt-0.5 truncate capitalize">
                  {session?.user?.role?.toLowerCase().replace(/_/g, ' ')}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                className="text-white/30 hover:text-white/80 transition-colors p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
              >
                <IcSignOut />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
