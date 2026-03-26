import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '@/lib/db/notifications'

export async function GET(request) {
  const { error, session } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = Number(searchParams.get('limit') || 20)

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(session.user.id, { unreadOnly, limit }),
    getUnreadCount(session.user.id),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH(request) {
  const { error, session } = await requireAuth('read')
  if (error) return error

  const body = await request.json()

  if (body.all) {
    await markAllRead(session.user.id)
    return NextResponse.json({ success: true })
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await markRead(session.user.id, body.ids)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Provide ids[] or all:true' }, { status: 400 })
}
