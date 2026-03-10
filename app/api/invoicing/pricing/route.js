import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getPricingConfig } from '@/lib/db/invoicing'

export async function GET() {
  const { error } = await requireAuth('read')
  if (error) return error
  const config = await getPricingConfig()
  return NextResponse.json(config)
}
