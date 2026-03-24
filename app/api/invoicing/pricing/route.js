import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getPricingConfig } from '@/lib/db/invoicing'

export async function GET() {
  const { error } = await requirePermission('invoicing', 'view')
  if (error) return error
  const config = await getPricingConfig()
  return NextResponse.json(config)
}
