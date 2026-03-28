import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getLeadActivities, createLeadActivity, getLead } from '@/lib/db/pipeline'
import { logActivity } from '@/lib/activityLog'

const ACTIVITY_LABELS = {
  Call:         'Call',
  Email:        'Email',
  Meeting:      'Meeting',
  Demo:         'Demo',
  ProposalSent: 'Proposal Sent',
  Other:        'Other',
}

export async function GET(request, { params }) {
  const { error } = await requirePermission('pipeline', 'view')
  if (error) return error

  const { id } = await params
  const activities = await getLeadActivities(id)
  return NextResponse.json(activities)
}

export async function POST(request, { params }) {
  const { error, session } = await requirePermission('pipeline', 'create')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  if (!body.type) return NextResponse.json({ error: 'type is required' }, { status: 400 })
  if (!body.loggedAt) return NextResponse.json({ error: 'loggedAt is required' }, { status: 400 })

  const activity = await createLeadActivity(id, { ...body, actorId: session.user.id })

  const lead = await getLead(id)
  await logActivity({
    entity: 'Lead', entityId: Number(id), accountId: lead?.accountId || null,
    action: 'activity_logged',
    actorId: session.user.id, actorName: session.user.name,
    meta: {
      companyName: lead?.companyName,
      type: ACTIVITY_LABELS[body.type] || body.type,
      outcome: body.outcome || undefined,
    },
  })

  return NextResponse.json(activity, { status: 201 })
}
