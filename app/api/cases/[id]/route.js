import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import {
  getCase,
  updateCase,
  updateCaseStatus,
  addFollowUp,
  deleteCase,
} from '@/lib/db/engagementCases'
import { createNotifications } from '@/lib/db/notifications'

const STATUS_LABELS = {
  Open: 'Open', Resolved: 'Resolved', ClosedUnresolved: 'Closed (Unresolved)', Escalated: 'Escalated',
}

/** Collect unique recipient IDs, excluding the actor themselves. */
function recipients(c, actorId) {
  return [...new Set([c.openedBy?.id, c.assignedTo?.id].filter(Boolean))].filter((id) => id !== actorId)
}

export async function GET(request, { params }) {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const c = await getCase(params.id)
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(c)
}

export async function PATCH(request, { params }) {
  const { error, session } = await requirePermission('cases', 'edit')
  if (error) return error

  const body = await request.json()

  if (body.action === 'updateStatus') {
    if (!body.status) return NextResponse.json({ error: 'status is required' }, { status: 400 })
    const c = await updateCaseStatus(params.id, body.status)
    const recs = recipients(c, session.user.id)
    if (recs.length) {
      await createNotifications(recs, {
        type: 'CaseStatusChanged',
        title: `Case marked ${STATUS_LABELS[body.status] || body.status}: ${c.title}`,
        link: `/cases/${c.id}`,
      })
    }
    return NextResponse.json(c)
  }

  if (body.action === 'update') {
    const c = await updateCase(params.id, body)
    // Notify newly assigned person (if reassigned and not self)
    if (body.assignedToId && body.assignedToId !== session.user.id) {
      await createNotifications([body.assignedToId], {
        type: 'CaseReassigned',
        title: `Case reassigned to you: ${c.title}`,
        link: `/cases/${c.id}`,
      })
    }
    return NextResponse.json(c)
  }

  if (body.action === 'addFollowUp') {
    if (!body.loggedAt) return NextResponse.json({ error: 'loggedAt is required' }, { status: 400 })
    const fu = await addFollowUp(params.id, body, session.user.id)
    // Notify case participants (opener + assignee, excluding actor)
    const c = await getCase(params.id)
    const recs = recipients(c, session.user.id)
    if (recs.length) {
      await createNotifications(recs, {
        type: 'CaseFollowUpAdded',
        title: `Follow-up added on: ${c.title}`,
        link: `/cases/${c.id}`,
      })
    }
    return NextResponse.json(fu, { status: 201 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('cases', 'delete')
  if (error) return error

  await deleteCase(params.id)
  return NextResponse.json({ success: true })
}
