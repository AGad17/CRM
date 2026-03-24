import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getCSRepPerformance } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requirePermission('analytics', 'view')
  if (error) return error

  const data = await getCSRepPerformance()
  return NextResponse.json(data)
}
