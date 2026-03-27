'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

const TYPE_ICONS = {
  CaseAssigned:      '📋',
  CaseReassigned:    '📋',
  CaseStatusChanged: '📋',
  CaseFollowUpAdded: '💬',
  OutageDeclared:    '🔴',
  OutageResolved:    '✅',
  RenewalDue30:      '📅',
  RenewalDue14:      '📅',
  RenewalDue7:       '⚠️',
  InvoiceOverdue:    '💸',
  UserMentioned:          '@',
  MentionInLeadComment:   '💬',
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications?limit=10').then((r) => r.json()),
    refetchInterval: 30_000,
  })

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const markMutation = useMutation({
    mutationFn: (payload) => fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleNotifClick(n) {
    markMutation.mutate({ ids: [n.id] })
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markMutation.mutate({ all: true })}
                className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-[#F5F2FF]/60' : ''}`}
                >
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">
                    {TYPE_ICONS[n.type] || '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug truncate ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#5061F6] flex-shrink-0 mt-1" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); router.push('/notifications') }}
              className="text-xs text-[#5061F6] hover:text-[#3b4cc4] font-medium"
            >
              See all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
