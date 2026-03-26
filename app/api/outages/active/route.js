import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getActiveOutages } from '@/lib/db/engagementCases'

export async function GET() {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const outages = await getActiveOutages()
  return NextResponse.json(outages)
}
