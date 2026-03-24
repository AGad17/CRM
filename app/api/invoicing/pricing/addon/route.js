import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { saveAddOnPricing } from '@/lib/db/invoicing'

/**
 * POST /api/invoicing/pricing/addon
 * Body: { rows: [{ countryCode, salesChannel, module, annualPrice, currency }] }
 * Saves add-on pricing (expire old + create new for history).
 */
export async function POST(request) {
  const { error } = await requirePermission('invoicing', 'edit')
  if (error) return error

  const { rows } = await request.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows array required' }, { status: 400 })
  }

  try {
    const config = await saveAddOnPricing(rows)
    return NextResponse.json(config)
  } catch (err) {
    console.error('[addon-pricing]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
