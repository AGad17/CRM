import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { updateCountry, deleteCountry } from '@/lib/db/countries'

export async function PUT(request, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const body = await request.json()
  const country = await updateCountry(Number(params.id), body)
  return NextResponse.json(country)
}

export async function DELETE(_, { params }) {
  const { error } = await requireAuth('delete')
  if (error) return error

  try {
    await deleteCountry(Number(params.id))
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
