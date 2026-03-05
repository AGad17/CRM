import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { addPricing } from '@/lib/db/products'

const COUNTRIES = ['KSA', 'Egypt', 'UAE', 'Bahrain', 'Jordan']

export async function POST(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const body = await request.json()

  if (!body.country || !body.price) {
    return NextResponse.json({ error: 'country and price are required' }, { status: 400 })
  }

  if (!COUNTRIES.includes(body.country)) {
    return NextResponse.json({ error: 'Invalid country' }, { status: 400 })
  }

  if (Number(body.price) <= 0) {
    return NextResponse.json({ error: 'price must be > 0' }, { status: 400 })
  }

  const pricing = await addPricing(Number(params.id), body)
  return NextResponse.json(pricing, { status: 201 })
}
