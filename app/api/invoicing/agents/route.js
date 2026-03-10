import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getActiveAgents } from '@/lib/db/invoicing'

export async function GET() {
  const { error } = await requireAuth('read')
  if (error) return error
  const agents = await getActiveAgents()
  return NextResponse.json(agents)
}
