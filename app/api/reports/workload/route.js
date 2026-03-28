import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getWorkload } from '@/lib/db/reports'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || null
  const module = searchParams.get('module') || 'all'

  const data = await getWorkload({ userId, module })
  return NextResponse.json(data)
}
