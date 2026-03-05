import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getCohorts } from '@/lib/db/analytics'

export async function GET() {
  const { error } = await requireAuth('read')
  if (error) return error
  return NextResponse.json(await getCohorts())
}
