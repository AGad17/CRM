import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getUsers, createUser } from '@/lib/db/users'

export async function GET() {
  const { error } = await requireAuth('delete')
  if (error) return error

  const users = await getUsers()
  return NextResponse.json(users)
}

export async function POST(request) {
  const { error } = await requireAuth('delete')
  if (error) return error

  const body = await request.json()
  if (!body.email || !body.password || !body.role) {
    return NextResponse.json({ error: 'email, password, and role are required' }, { status: 400 })
  }

  try {
    const user = await createUser(body)
    return NextResponse.json(user, { status: 201 })
  } catch (e) {
    if (e.message?.includes('already exists')) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
}
