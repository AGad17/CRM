import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const { id } = await params
  const tracker = await prisma.onboardingTracker.findUnique({
    where: { accountId: Number(id) },
  })

  if (!tracker) return NextResponse.json({ csat: [], nps: [] })

  const [csat, nps] = await Promise.all([
    prisma.csatRecord.findMany({
      where: { trackerId: tracker.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.npsRecord.findMany({
      where: { trackerId: tracker.id },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({ csat, nps })
}
