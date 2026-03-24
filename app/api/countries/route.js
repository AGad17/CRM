import { NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/roleGuard'
import { getCountries, createCountry } from '@/lib/db/countries'

export async function GET() {
  const { error } = await requirePermission('settings', 'view')
  if (error) return error

  const countries = await getCountries()
  return NextResponse.json(countries)
}

export async function POST(request) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const body = await request.json()
  if (!body.code || !body.name || !body.currency) {
    return NextResponse.json({ error: 'code, name, and currency are required' }, { status: 400 })
  }

  try {
    const country = await createCountry(body)
    return NextResponse.json(country, { status: 201 })
  } catch (e) {
    if (e.message?.includes('Unique')) return NextResponse.json({ error: 'Country code already exists' }, { status: 409 })
    throw e
  }
}
