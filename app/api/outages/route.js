import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getAllOutages, createOutage } from '@/lib/db/engagementCases'
import { createNotifications, getAllActiveUserIds } from '@/lib/db/notifications'

export async function GET() {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const outages = await getAllOutages()
  return NextResponse.json(outages)
}

export async function POST(request) {
  const { error, session } = await requirePermission('cases', 'edit')
  if (error) return error

  const body = await request.json()
  if (!body.title || !body.channel) {
    return NextResponse.json({ error: 'title and channel are required' }, { status: 400 })
  }

  const outage = await createOutage(body, session.user.id)

  // Broadcast to all active users
  const userIds = await getAllActiveUserIds()
  await createNotifications(userIds, {
    type: 'OutageDeclared',
    title: `🔴 Outage declared: ${outage.title}`,
    link: `/outages/${outage.id}`,
  })

  return NextResponse.json(outage, { status: 201 })
}
