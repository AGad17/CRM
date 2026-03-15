import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAuth } from '@/lib/roleGuard'
import { getLead, updateLead, updateLeadStage, deleteLead, linkLeadToAccount } from '@/lib/db/pipeline'
import { logActivity } from '@/lib/activityLog'

export async function GET(request, { params }) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { id } = await params
  const lead = await getLead(id)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PUT(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const { id } = await params
  const body = await request.json()

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
    const lead = await updateLead(id, body)
    return NextResponse.json(lead)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// PATCH: stage transition only
export async function PATCH(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const session = await getServerSession(authOptions)
  const actor = { actorId: session?.user?.id, actorName: session?.user?.name || session?.user?.email }

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
      meta: { from: existing?.stage, to: body.stage, lostReason: body.lostReason || undefined },
    })
    return NextResponse.json(lead)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const { id } = await params

  try {
    await deleteLead(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
