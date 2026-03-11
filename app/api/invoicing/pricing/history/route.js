import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getPricingHistory } from '@/lib/db/invoicing'

/**
 * GET /api/invoicing/pricing/history?country=Egypt
 */
export async function GET(request) {
  const { error } = await requireAuth('read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const countryCode = searchParams.get('country') || undefined

  try {
    const history = await getPricingHistory({ countryCode })
    return NextResponse.json(history)
  } catch (err) {
    console.error('[pricing-history]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
