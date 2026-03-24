import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getARReport } from '@/lib/db/invoicing'

export async function GET() {
  const { error } = await requirePermission('invoicing', 'view')
  if (error) return error
  const report = await getARReport()
  return NextResponse.json(report)
}
