import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getEngagementLogs } from '@/lib/db/engagementLogs'

export async function GET(request, { params }) {
  const { error } = await requireAuth('read')
  if (error) return error

  const logs = await getEngagementLogs({ accountId: params.id })
  return NextResponse.json(logs)
}
