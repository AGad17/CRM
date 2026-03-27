'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

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
  UserMentioned:        '@',
  MentionInLeadComment: '💬',
}

const TYPE_CATEGORY = {
  CaseAssigned: 'cases', CaseReassigned: 'cases', CaseStatusChanged: 'cases', CaseFollowUpAdded: 'cases',
  OutageDeclared: 'outages', OutageResolved: 'outages',
  RenewalDue30: 'renewals', RenewalDue14: 'renewals', RenewalDue7: 'renewals',
  InvoiceOverdue: 'invoices',
  UserMentioned: 'mentions',
  MentionInLeadComment: 'mentions',
}

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'unread',   label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'cases',    label: 'Cases' },
  { key: 'outages',  label: 'Outages' },
  { key: 'renewals', label: 'Renewals' },
  { key: 'invoices', label: 'Invoices' },
]

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotificationsPage() {
  const [tab, setTab] = useState('all')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-all'],
    queryFn: () => fetch('/api/notifications?limit=100').then((r) => r.json()),
    refetchInterval: 30_000,
  })

  const markMutation = useMutation({
    mutationFn: (payload) => fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const all = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const visible = all.filter((n) => {
    if (tab === 'unread') return !n.isRead
    if (tab === 'all') return true
    return TYPE_CATEGORY[n.type] === tab
  })

  if (isLoading) return (
    <div className="animate-pulse space-y-3">
      <div className="h-12 bg-gray-100 rounded-2xl" />
      {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markMutation.mutate({ all: true })}
            disabled={markMutation.isPending}
            className="text-sm text-[#5061F6] hover:text-[#3b4cc4] font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.key === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-1">
        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
            <p className="text-sm text-gray-400">No notifications in this category</p>
          </div>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className={`bg-white rounded-2xl border px-4 py-3 flex items-start gap-3 transition-colors ${
                !n.isRead ? 'border-[#5061F6]/20 bg-[#F5F2FF]/40' : 'border-gray-100'
              }`}
            >
              <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                {TYPE_ICONS[n.type] || '🔔'}
              </span>
              <div className="flex-1 min-w-0">
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => !n.isRead && markMutation.mutate({ ids: [n.id] })}
                    className={`text-sm leading-snug hover:text-[#5061F6] transition-colors ${
                      !n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                    }`}
                  >
                    {n.title}
                  </Link>
                ) : (
                  <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {n.title}
                  </p>
                )}
                {n.body && <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">{relativeTime(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => markMutation.mutate({ ids: [n.id] })}
                  className="flex-shrink-0 w-2 h-2 rounded-full bg-[#5061F6] mt-1.5 hover:bg-[#3b4cc4] transition-colors"
                  title="Mark as read"
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
