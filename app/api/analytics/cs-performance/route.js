import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getCSRepPerformance } from '@/lib/db/analytics'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const data = await getCSRepPerformance()
  return NextResponse.json(data)
}
