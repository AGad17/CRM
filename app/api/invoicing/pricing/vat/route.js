import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { updateCountryVAT } from '@/lib/db/invoicing'

/**
 * POST /api/invoicing/pricing/vat
 * Body: { countryCode: string, vatRate: number }  (vatRate as decimal, e.g. 0.15 = 15%)
 * Updates the VAT rate for a country and returns the full pricing config.
 */
export async function POST(request) {
  const { error } = await requirePermission('invoicing', 'edit')
  if (error) return error

  const { countryCode, vatRate } = await request.json()
  if (!countryCode || vatRate === undefined || vatRate === null) {
    return NextResponse.json({ error: 'countryCode and vatRate are required' }, { status: 400 })
  }

  try {
    const config = await updateCountryVAT(countryCode, vatRate)
    return NextResponse.json(config)
  } catch (err) {
    console.error('[vat-pricing]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
