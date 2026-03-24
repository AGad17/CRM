import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getAccountHealthHistory } from '@/lib/db/analytics'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const { id } = await params
  const history = await getAccountHealthHistory(id)
  return NextResponse.json(history)
}
