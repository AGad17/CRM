import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getCasesByAccount } from '@/lib/db/engagementCases'

export async function GET(request, { params }) {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const cases = await getCasesByAccount(params.id)
  return NextResponse.json(cases)
}
