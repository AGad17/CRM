import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getActiveAgents } from '@/lib/db/invoicing'

export async function GET() {
  const { error } = await requirePermission('invoicing', 'view')
  if (error) return error
  const agents = await getActiveAgents()
  return NextResponse.json(agents)
}
