import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getEngagementLogs, createEngagementLog } from '@/lib/db/engagementLogs'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {}
  if (searchParams.get('accountId'))  filters.accountId  = searchParams.get('accountId')
  if (searchParams.get('channel'))    filters.channel    = searchParams.get('channel')
  if (searchParams.get('objective'))  filters.objective  = searchParams.get('objective')
  if (searchParams.get('loggedById')) filters.loggedById = searchParams.get('loggedById')
  if (searchParams.get('from'))       filters.from       = searchParams.get('from')
  if (searchParams.get('to'))         filters.to         = searchParams.get('to')

  const logs = await getEngagementLogs(filters)
  return NextResponse.json(logs)
}

export async function POST(request) {
  const { error, session } = await requireAuth('ops')
  if (error) return error

  const body = await request.json()
  if (!body.accountId || !body.channel || !body.objective || !body.loggedAt) {
    return NextResponse.json(
      { error: 'accountId, channel, objective and loggedAt are required' },
      { status: 400 }
    )
  }

  const log = await createEngagementLog(body, session.user.id)
  return NextResponse.json(log, { status: 201 })
}
