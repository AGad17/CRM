import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { deleteFollowUp } from '@/lib/db/engagementCases'

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('cases', 'delete')
  if (error) return error

  await deleteFollowUp(params.fid)
  return NextResponse.json({ success: true })
}
