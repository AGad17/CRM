import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getInvoices } from '@/lib/db/invoicing'

export async function GET(request) {
  const { error } = await requirePermission('invoicing', 'view')
  if (error) return error
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'foodicsAR'
  const invoices = await getInvoices(view)
  return NextResponse.json(invoices)
}
