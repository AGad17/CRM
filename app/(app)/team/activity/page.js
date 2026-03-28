'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

const MODULE_LABELS = {
  all: 'All Modules', pipeline: 'Pipeline', invoicing: 'Invoicing',
  onboarding: 'Onboarding', cases: 'Cases', accounts: 'Accounts',
}

const DATE_RANGES = [
  { label: 'Today',      days: 1  },
  { label: 'This week',  days: 7  },
  { label: 'This month', days: 30 },
  { label: 'All time',   days: 0  },
]

const MODULE_COLORS = {
  pipeline:   'bg-indigo-100 text-indigo-700',
  invoicing:  'bg-green-100 text-green-700',
  onboarding: 'bg-yellow-100 text-yellow-700',
  cases:      'bg-red-100 text-red-700',
  accounts:   'bg-blue-100 text-blue-700',
  other:      'bg-gray-100 text-gray-600',
}

const MODULE_ICONS = {
  pipeline: '🎯', invoicing: '💼', onboarding: '🏗️', cases: '🎫', accounts: '🏢', other: '📋',
}

const ACTION_ICONS = {
  stage_changed:    '↗',
  closed_won:       '🏆',
  created:          '✚',
  phase_advanced:   '→',
  phase_changed:    '↺',
  status_changed:   '◐',
  opened:           '🔓',
  follow_up_added:  '💬',
  engagement_logged:'📝',
  comment_added:    '💬',
}

function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-green-500',
  'bg-amber-500',  'bg-rose-500',   'bg-cyan-500', 'bg-pink-500',
]
function avatarColor(name = '') {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export default function ActivityPage() {
  const router = useRouter()
  const [userId,    setUserId]    = useState('')
  const [module,    setModule]    = useState('all')
  const [rangeDays, setRangeDays] = useState(7)

  const { data: users = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => fetch('/api/users/staff').then(r => r.json()),
  })

  const params = new URLSearchParams({ limit: '200' })
  if (userId) params.set('userId', userId)
  if (module !== 'all') params.set('module', module)
  if (rangeDays > 0) {
    const from = new Date(Date.now() - rangeDays * 86400000).toISOString()
    params.set('from', from)
  }

  const { data: feed = [], isLoading } = useQuery({
    queryKey: ['activity', userId, module, rangeDays],
    queryFn: () => fetch(`/api/reports/activity?${params}`).then(r => r.json()),
  })

  // Group by date for timeline headers
  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of feed) {
      const day = new Date(item.createdAt).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
      if (!map.has(day)) map.set(day, [])
      map.get(day).push(item)
    }
    return [...map.entries()]
  }, [feed])

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-xl px-4 py-3">
        <select value={userId} onChange={e => setUserId(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">All Team Members</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select value={module} onChange={e => setModule(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {Object.entries(MODULE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <div className="flex gap-1 ml-auto">
          {DATE_RANGES.map(r => (
            <button key={r.days} onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                rangeDays === r.days
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      ) : feed.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">No activity found for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{day}</p>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">{items.length} event{items.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Events */}
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id}
                    onClick={() => item.link && router.push(item.link)}
                    className={`flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 transition-all ${item.link ? 'cursor-pointer hover:border-indigo-200 hover:shadow-sm' : ''}`}>

                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor(item.userName)}`}>
                      {initials(item.userName)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-800">
                          <span className="font-semibold">{item.userName || 'System'}</span>
                          {' '}
                          <span className="text-gray-600">{item.action}</span>
                          {item.entityName && (
                            <span className="font-medium text-gray-900"> {item.entityName}</span>
                          )}
                          {item.meta?.to && (
                            <span className="text-gray-500"> → <span className="font-medium text-gray-700">{item.meta.to}</span></span>
                          )}
                        </p>
                        <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">{relativeTime(item.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        {item.accountName && (
                          <span className="text-xs text-gray-400">📍 {item.accountName}</span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MODULE_COLORS[item.module] || MODULE_COLORS.other}`}>
                          {MODULE_ICONS[item.module]} {MODULE_LABELS[item.module] || item.module}
                        </span>
                        {item.meta?.notes && (
                          <span className="text-xs text-gray-400 truncate max-w-xs italic">"{item.meta.notes}"</span>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
