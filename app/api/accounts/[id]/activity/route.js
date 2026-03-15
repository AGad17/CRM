import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getAccountActivityLog } from '@/lib/activityLog'

export async function GET(request, { params }) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { id } = await params
  const logs = await getAccountActivityLog(id)
  return NextResponse.json(logs)
}
