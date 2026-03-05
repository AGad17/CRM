import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updatePricing, deletePricing } from '@/lib/db/products'

export async function PUT(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const body = await request.json()

  if (body.price !== undefined && Number(body.price) <= 0) {
    return NextResponse.json({ error: 'price must be > 0' }, { status: 400 })
  }

  const pricing = await updatePricing(Number(params.pricingId), body)
  return NextResponse.json(pricing)
}

export async function DELETE(_, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  await deletePricing(Number(params.pricingId))
  return NextResponse.json({ success: true })
}
