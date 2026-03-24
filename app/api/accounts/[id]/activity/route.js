import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getAccountActivityLog } from '@/lib/activityLog'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const { id } = await params
  const logs = await getAccountActivityLog(id)
  return NextResponse.json(logs)
}
