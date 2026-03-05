import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { cancelContract } from '@/lib/db/contracts'

export async function POST(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const body = await request.json()
  const cancellationDate = body.cancellationDate || new Date().toISOString()

  const contract = await cancelContract(params.id, cancellationDate)
  return NextResponse.json(contract)
}
