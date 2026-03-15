import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAuth } from '@/lib/roleGuard'
import { updateInvoice, getInvoiceById } from '@/lib/db/invoicing'
import { logActivity } from '@/lib/activityLog'

export async function PATCH(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error
  const { id } = await params
  const body = await request.json()
  const session = await getServerSession(authOptions)
  const actor = { actorId: session?.user?.id, actorName: session?.user?.name || session?.user?.email }

  const before = await getInvoiceById(id)
  const invoice = await updateInvoice(id, body)

  if (body.status && body.status !== before?.status) {
    await logActivity({
      entity: 'Invoice', entityId: Number(id), action: 'status_changed',
      ...actor,
      meta: { from: before?.status, to: body.status, invoiceNumber: invoice.invoiceNumber },
    })
  }

  return NextResponse.json(invoice)
}
