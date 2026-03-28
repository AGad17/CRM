import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requirePermission } from '@/lib/roleGuard'
import { getLead, updateLead, updateLeadStage, deleteLead, linkLeadToAccount, archiveLead } from '@/lib/db/pipeline'
import { logActivity, getActivityLog } from '@/lib/activityLog'
import { createNotifications } from '@/lib/db/notifications'

export async function GET(request, { params }) {
  const { error } = await requirePermission('pipeline', 'view')
  if (error) return error

  const { id } = await params
  const [lead, activityLog] = await Promise.all([
    getLead(id),
    getActivityLog('Lead', Number(id), 50),
  ])
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...lead, activityLog })
}

export async function PUT(request, { params }) {
  const { error } = await requirePermission('pipeline', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const session = await getServerSession(authOptions)
  const actor = { actorId: session?.user?.id, actorName: session?.user?.name || session?.user?.email }

  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }
  if (!body.channel) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 })
  }
  if (!body.ownerId) {
    return NextResponse.json({ error: 'ownerId is required' }, { status: 400 })
  }

  try {
    const old  = await getLead(id)
    const lead = await updateLead(id, body)

    // Build human-readable diff
    const changes = []
    if (body.companyName !== undefined && body.companyName !== old.companyName)
      changes.push({ field: 'Company Name', from: old.companyName, to: body.companyName })
    if (body.channel !== undefined && body.channel !== old.channel)
      changes.push({ field: 'Channel', from: old.channel, to: body.channel })
    if (body.countryCode !== undefined && (body.countryCode || null) !== old.countryCode)
      changes.push({ field: 'Country', from: old.countryCode || '(none)', to: body.countryCode || '(none)' })
    if (body.packageInterest !== undefined && (body.packageInterest || null) !== old.packageInterest)
      changes.push({ field: 'Package', from: old.packageInterest || '(none)', to: body.packageInterest || '(none)' })
    if (body.estimatedValue !== undefined && Number(body.estimatedValue || 0) !== Number(old.estimatedValue || 0))
      changes.push({ field: 'Est. Value', from: old.estimatedValue || 0, to: body.estimatedValue || 0 })
    if (body.expectedCloseDate !== undefined) {
      const oldD = old.expectedCloseDate ? new Date(old.expectedCloseDate).toISOString().slice(0, 10) : null
      const newD = body.expectedCloseDate || null
      if (oldD !== newD) changes.push({ field: 'Expected Close', from: oldD || '(none)', to: newD || '(none)' })
    }
    if (body.nextActionDate !== undefined) {
      const oldD = old.nextActionDate ? new Date(old.nextActionDate).toISOString().slice(0, 10) : null
      const newD = body.nextActionDate || null
      if (oldD !== newD) changes.push({ field: 'Next Action Date', from: oldD || '(none)', to: newD || '(none)' })
    }
    if (body.ownerId !== undefined && body.ownerId !== old.ownerId)
      changes.push({ field: 'Owner', from: old.owner?.name || old.ownerId, to: lead.owner?.name || body.ownerId })

    if (changes.length) {
      await logActivity({
        entity: 'Lead', entityId: Number(id), accountId: lead.accountId || null,
        action: 'lead_edited', ...actor,
        meta: { companyName: lead.companyName, changes },
      })
    }

    // Notify new owner if reassigned
    if (body.ownerId && body.ownerId !== old.ownerId && body.ownerId !== session?.user?.id) {
      await createNotifications([body.ownerId], {
        type:  'LeadAssignmentChanged',
        title: `Lead assigned to you: ${lead.companyName}`,
        link:  `/pipeline?lead=${lead.id}`,
      })
    }

    return NextResponse.json(lead)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// PATCH: stage transition only
export async function PATCH(request, { params }) {
  const { error } = await requirePermission('pipeline', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const session = await getServerSession(authOptions)
  const actor = { actorId: session?.user?.id, actorName: session?.user?.name || session?.user?.email }

  // action=archive
  if (body.action === 'archive') {
    if (!body.reason?.trim()) return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    try {
      const existing = await getLead(id)
      const lead = await archiveLead(id, body.reason.trim())
      await logActivity({
        entity: 'Lead', entityId: Number(id), accountId: existing?.accountId || null,
        action: 'lead_archived', ...actor,
        meta: { companyName: existing?.companyName, reason: body.reason.trim() },
      })
      return NextResponse.json(lead)
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
  }

  // action=link: associate an existing Account with this lead
  if (body.action === 'link') {
    if (!body.accountId) {
      return NextResponse.json({ error: 'accountId is required for link action' }, { status: 400 })
    }
    try {
      const lead = await linkLeadToAccount(id, body.accountId)
      return NextResponse.json(lead)
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
  }

  if (!body.stage) {
    return NextResponse.json({ error: 'stage is required' }, { status: 400 })
  }

  try {
    const existing = await getLead(id)
    const lead = await updateLeadStage(id, body.stage, body)
    await logActivity({
      entity: 'Lead', entityId: Number(id), accountId: existing?.accountId || null, action: 'stage_changed',
      ...actor,
      meta: { from: existing?.stage, to: body.stage, lostReason: body.lostReason || undefined, lostReasonCategory: body.lostReasonCategory || undefined },
    })
    return NextResponse.json(lead)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('pipeline', 'delete')
  if (error) return error

  const { id } = await params

  try {
    await deleteLead(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
