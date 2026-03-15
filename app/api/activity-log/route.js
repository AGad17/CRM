import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getActivityLog } from '@/lib/activityLog'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const entity   = searchParams.get('entity')
  const entityId = searchParams.get('entityId')
  const limit    = Number(searchParams.get('limit')) || 50

  if (!entity || !entityId) {
    return NextResponse.json({ error: 'entity and entityId are required' }, { status: 400 })
  }

  const logs = await getActivityLog(entity, entityId, limit)
  return NextResponse.json(logs)
}
