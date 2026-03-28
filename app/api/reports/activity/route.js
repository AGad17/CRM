import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getActivity } from '@/lib/db/reports'

export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || null
  const module = searchParams.get('module') || 'all'
  const from   = searchParams.get('from')   || null
  const to     = searchParams.get('to')     || null
  const limit  = Number(searchParams.get('limit')) || 100

  const data = await getActivity({ userId, module, from, to, limit })
  return NextResponse.json(data)
}
