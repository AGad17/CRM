import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getARReport } from '@/lib/db/invoicing'

export async function GET() {
  const { error } = await requireAuth('read')
  if (error) return error
  const report = await getARReport()
  return NextResponse.json(report)
}
