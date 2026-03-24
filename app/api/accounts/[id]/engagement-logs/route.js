import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getEngagementLogs } from '@/lib/db/engagementLogs'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const logs = await getEngagementLogs({ accountId: params.id })
  return NextResponse.json(logs)
}
