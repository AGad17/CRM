import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { updateEngagementLog, deleteEngagementLog } from '@/lib/db/engagementLogs'

export async function PUT(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const body = await request.json()
  if (!body.channel || !body.objective || !body.loggedAt) {
    return NextResponse.json(
      { error: 'channel, objective and loggedAt are required' },
      { status: 400 }
    )
  }

  const log = await updateEngagementLog(params.id, body)
  return NextResponse.json(log)
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  await deleteEngagementLog(params.id)
  return NextResponse.json({ success: true })
}
