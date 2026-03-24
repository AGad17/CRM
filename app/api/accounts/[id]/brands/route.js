import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const { id } = await params
  const brands = await prisma.accountBrand.findMany({
    where: { accountId: Number(id) },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(brands)
}

export async function POST(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const { id } = await params
  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const brand = await prisma.accountBrand.create({
    data: { accountId: Number(id), name: name.trim() },
  })
  return NextResponse.json(brand, { status: 201 })
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  await prisma.accountBrand.delete({
    where: { id: Number(brandId), accountId: Number(id) },
  })
  return NextResponse.json({ ok: true })
}
