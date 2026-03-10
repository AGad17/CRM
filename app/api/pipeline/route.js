import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getLeads, createLead } from '@/lib/db/pipeline'

export async function GET(request) {
  const { error } = await requireAuth('read')
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
  const { error } = await requireAuth('write')
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

  const lead = await createLead(body)
  return NextResponse.json(lead, { status: 201 })
}
