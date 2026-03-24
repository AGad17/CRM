import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getProducts, createProduct } from '@/lib/db/products'

export async function GET() {
  const { error } = await requirePermission('settings', 'view')
  if (error) return error

  const products = await getProducts()
  return NextResponse.json(products)
}

export async function POST(request) {
  const { error } = await requirePermission('settings', 'edit')
  if (error) return error

  const body = await request.json()

  if (!body.name || !body.category) {
    return NextResponse.json({ error: 'name and category are required' }, { status: 400 })
  }

  if (!['Plan', 'AddOn'].includes(body.category)) {
    return NextResponse.json({ error: 'category must be Plan or AddOn' }, { status: 400 })
  }

  const product = await createProduct(body)
  return NextResponse.json(product, { status: 201 })
}
