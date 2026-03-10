import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updateCountryVAT } from '@/lib/db/invoicing'

export async function POST(request) {
  const { error } = await requireAuth('write')
  if (error) return error
  const body = await request.json()
  if (!body.countryCode || body.vatRate === undefined) {
    return NextResponse.json({ error: 'countryCode and vatRate required' }, { status: 400 })
  }
  const config = await updateCountryVAT(body.countryCode, body.vatRate)
  return NextResponse.json(config)
}
