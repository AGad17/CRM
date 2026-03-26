import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getCases, createCase } from '@/lib/db/engagementCases'

export async function GET(request) {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {}
  if (searchParams.get('status'))       filters.status       = searchParams.get('status')
  if (searchParams.get('objective'))    filters.objective    = searchParams.get('objective')
  if (searchParams.get('accountId'))    filters.accountId    = searchParams.get('accountId')
  if (searchParams.get('assignedToId')) filters.assignedToId = searchParams.get('assignedToId')
  if (searchParams.get('from'))         filters.from         = searchParams.get('from')
  if (searchParams.get('to'))           filters.to           = searchParams.get('to')

  const cases = await getCases(filters)
  return NextResponse.json(cases)
}

export async function POST(request) {
  const { error, session } = await requirePermission('cases', 'edit')
  if (error) return error

  const body = await request.json()
  if (!body.title || !body.channel || !body.objective) {
    return NextResponse.json(
      { error: 'title, channel, and objective are required' },
      { status: 400 }
    )
  }

  const c = await createCase(body, session.user.id)
  return NextResponse.json(c, { status: 201 })
}
