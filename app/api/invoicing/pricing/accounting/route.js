import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { upsertAccountingPricing } from '@/lib/db/invoicing'

export async function POST(request) {
  const { error } = await requireAuth('write')
  if (error) return error
  const body = await request.json()
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows[] required' }, { status: 400 })
  }
  const config = await upsertAccountingPricing(body.rows)
  return NextResponse.json(config)
}
