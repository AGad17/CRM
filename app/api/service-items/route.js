import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getServiceItems, createServiceItem } from '@/lib/db/serviceItems'

export async function GET(request) {
  const { error } = await requirePermission('pipeline', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('all') === 'true'
  const items = await getServiceItems({ includeInactive })
  return NextResponse.json(items)
}

export async function POST(request) {
  const { error } = await requirePermission('pipeline', 'write')
  if (error) return error

  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const item = await createServiceItem(body)
  return NextResponse.json(item, { status: 201 })
}
