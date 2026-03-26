import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getOutageWithCases, addFollowUp, resolveOutage } from '@/lib/db/engagementCases'
import { createNotifications, getAllActiveUserIds } from '@/lib/db/notifications'

export async function GET(request, { params }) {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const outage = await getOutageWithCases(params.id)
  if (!outage) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(outage)
}

export async function PATCH(request, { params }) {
  const { error, session } = await requirePermission('cases', 'edit')
  if (error) return error

  const body = await request.json()

  if (body.action === 'addFollowUp') {
    if (!body.loggedAt) return NextResponse.json({ error: 'loggedAt is required' }, { status: 400 })
    const fu = await addFollowUp(params.id, body, session.user.id)
    return NextResponse.json(fu, { status: 201 })
  }

  if (body.action === 'resolve') {
    const outage = await resolveOutage(params.id)
    const userIds = await getAllActiveUserIds()
    await createNotifications(userIds, {
      type: 'OutageResolved',
      title: `✅ Outage resolved: ${outage.title}`,
      link: `/outages/${outage.id}`,
    })
    return NextResponse.json(outage)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
