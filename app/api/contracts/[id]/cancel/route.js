import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { cancelContract } from '@/lib/db/contracts'

export async function POST(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const body = await request.json()
  const cancellationDate = body.cancellationDate || new Date().toISOString()

  const contract = await cancelContract(params.id, cancellationDate)
  return NextResponse.json(contract)
}
