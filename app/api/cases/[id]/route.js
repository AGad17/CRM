import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import {
  getCase,
  updateCase,
  updateCaseStatus,
  addFollowUp,
  deleteCase,
  voidCase,
} from '@/lib/db/engagementCases'
import { createNotification, createNotifications } from '@/lib/db/notifications'
import { parseMentions } from '@/lib/mentions'
import { logActivity, getActivityLog } from '@/lib/activityLog'

const STATUS_LABELS = {
  Open: 'Open', Resolved: 'Resolved', ClosedUnresolved: 'Closed (Unresolved)', Escalated: 'Escalated', Voided: 'Voided',
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
  const activityLog = await getActivityLog('Case', params.id)
  return NextResponse.json({ ...c, activityLog })
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
    await logActivity({
      entity: 'Case', entityId: c.id, accountId: c.accountId,
      action: 'status_changed', actorId: session.user.id, actorName: session.user.name,
      meta: { to: body.status, title: c.title },
    })
    return NextResponse.json(c)
  }

  if (body.action === 'update') {
    // Fetch before update to diff changes
    const old = await getCase(params.id)
    const c = await updateCase(params.id, body)

    // Build human-readable diff
    const changes = []
    if (body.title !== undefined && body.title !== old.title)
      changes.push({ field: 'Title', from: old.title, to: body.title })
    if (body.channel !== undefined && body.channel !== old.channel)
      changes.push({ field: 'Channel', from: old.channel, to: body.channel })
    if (body.objective !== undefined && body.objective !== old.objective)
      changes.push({ field: 'Objective', from: old.objective, to: body.objective })
    if (body.description !== undefined && (body.description || null) !== old.description)
      changes.push({ field: 'Description', from: old.description || '(none)', to: body.description || '(none)' })
    if (body.assignedToId !== undefined && (body.assignedToId || null) !== old.assignedToId)
      changes.push({ field: 'Assigned To', from: old.assignedTo?.name || 'Unassigned', to: c.assignedTo?.name || 'Unassigned' })
    if (body.accountId !== undefined && (body.accountId ? Number(body.accountId) : null) !== old.accountId)
      changes.push({ field: 'Account', from: old.account?.name || '(none)', to: c.account?.name || '(none)' })

    if (changes.length) {
      await logActivity({
        entity: 'Case', entityId: c.id, accountId: c.accountId,
        action: 'case_edited', actorId: session.user.id, actorName: session.user.name,
        meta: { title: c.title, changes },
      })
    }

    // Notify newly assigned person (if reassigned and not self)
    if (body.assignedToId && body.assignedToId !== session.user.id && body.assignedToId !== old.assignedToId) {
      await createNotifications([body.assignedToId], {
        type: 'CaseReassigned',
        title: `Case reassigned to you: ${c.title}`,
        link: `/cases/${c.id}`,
      })
    }
    return NextResponse.json(c)
  }

  if (body.action === 'void') {
    if (!body.reason?.trim()) return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    const c = await voidCase(params.id, body.reason.trim())
    await logActivity({
      entity: 'Case', entityId: c.id, accountId: c.accountId,
      action: 'case_voided', actorId: session.user.id, actorName: session.user.name,
      meta: { title: c.title, reason: body.reason.trim() },
    })
    const recs = recipients(c, session.user.id)
    if (recs.length) {
      await createNotifications(recs, {
        type: 'CaseStatusChanged',
        title: `Case voided: ${c.title}`,
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
        link: `/cases/${c.id}#followup-${fu.id}`,
      })
    }
    // @mention notifications
    const mentionText = [body.notes, body.actionTaken].filter(Boolean).join(' ')
    const actorName   = session.user.name || session.user.email
    for (const { userId } of parseMentions(mentionText)) {
      if (userId !== session.user.id) {
        await createNotification({
          userId,
          type:  'UserMentioned',
          title: `${actorName} mentioned you in a follow-up on "${c.title}"`,
          body:  body.notes?.slice(0, 120) || undefined,
          link:  `/cases/${c.id}#followup-${fu.id}`,
        })
      }
    }
    await logActivity({
      entity: 'Case', entityId: Number(params.id), accountId: c.accountId,
      action: 'follow_up_added', actorId: session.user.id, actorName: session.user.name,
      meta: { title: c.title },
    })
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
