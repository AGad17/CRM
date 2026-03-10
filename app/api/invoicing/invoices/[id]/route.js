import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updateInvoice } from '@/lib/db/invoicing'

export async function PATCH(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error
  const body = await request.json()
  const invoice = await updateInvoice(params.id, body)
  return NextResponse.json(invoice)
}
