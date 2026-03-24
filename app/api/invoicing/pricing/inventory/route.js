import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { saveInventoryPricing } from '@/lib/db/invoicing'

/**
 * POST /api/invoicing/pricing/inventory
 * Body: { rows: [{ countryCode, salesChannel, package, annualPrice, currency }] }
 * Saves inventory pricing (expire old + create new for history).
 */
export async function POST(request) {
  const { error } = await requirePermission('invoicing', 'edit')
  if (error) return error

  const { rows } = await request.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows array required' }, { status: 400 })
  }

  try {
    const config = await saveInventoryPricing(rows)
    return NextResponse.json(config)
  } catch (err) {
    console.error('[inventory-pricing]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
