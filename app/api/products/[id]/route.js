import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getProductById, updateProduct } from '@/lib/db/products'

export async function GET(_, { params }) {
  const { error } = await requireAuth('read')
  if (error) return error

  const product = await getProductById(Number(params.id))
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const body = await request.json()

  if (body.category && !['Plan', 'AddOn'].includes(body.category)) {
    return NextResponse.json({ error: 'category must be Plan or AddOn' }, { status: 400 })
  }

  const product = await updateProduct(Number(params.id), body)
  return NextResponse.json(product)
}
