import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getAccountHealthHistory } from '@/lib/db/analytics'

export async function GET(request, { params }) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { id } = await params
  const history = await getAccountHealthHistory(id)
  return NextResponse.json(history)
}
