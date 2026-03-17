import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { churnAccount } from '@/lib/db/accounts'

export async function POST(_, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const result = await churnAccount(Number(params.id))
  return NextResponse.json(result)
}
