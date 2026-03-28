import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getLeads, createLead } from '@/lib/db/pipeline'
import { logActivity } from '@/lib/activityLog'

export async function GET(request) {
  const { error } = await requirePermission('pipeline', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {
    stage:       searchParams.get('stage')       || undefined,
    channel:     searchParams.get('channel')     || undefined,
    countryCode: searchParams.get('countryCode') || undefined,
    ownerId:     searchParams.get('ownerId')     || undefined,
  }

  const leads = await getLeads(filters)
  return NextResponse.json(leads)
}

export async function POST(request) {
  const { error, session } = await requirePermission('pipeline', 'create')
  if (error) return error

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

  // For expansion/renewal, accountId is required
  if ((body.opportunityType === 'Expansion' || body.opportunityType === 'Renewal') && !body.accountId) {
    return NextResponse.json({ error: 'accountId is required for Expansion/Renewal opportunities' }, { status: 400 })
  }

  const lead = await createLead(body)
  await logActivity({
    entity: 'Lead', entityId: lead.id, accountId: lead.accountId || null,
    action: 'created', actorId: session?.user?.id, actorName: session?.user?.name,
    meta: { companyName: lead.companyName, channel: lead.channel },
  })
  return NextResponse.json(lead, { status: 201 })
}
