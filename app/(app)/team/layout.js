'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/team/workload', label: 'Workload' },
  { href: '/team/activity', label: 'Activity Feed' },
]

export default function TeamLayout({ children }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Team Overview</h2>
        <p className="text-sm text-gray-500 mt-0.5">Monitor workload and activity across every module.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/')
          return (
            <Link key={t.href} href={t.href}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
