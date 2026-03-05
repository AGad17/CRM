import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { churnAccount } from '@/lib/db/accounts'

export async function POST(_, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const result = await churnAccount(Number(params.id))
  return NextResponse.json(result)
}
