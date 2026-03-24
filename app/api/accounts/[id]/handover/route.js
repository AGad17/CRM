import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const { id } = await params
  const doc = await prisma.handoverDocument.findFirst({
    where: { accountId: Number(id) },
    orderBy: { createdAt: 'desc' },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(doc)
}

export async function PATCH(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const doc = await prisma.handoverDocument.findFirst({
    where: { accountId: Number(id) },
    orderBy: { createdAt: 'desc' },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = [
    'clientName', 'contractStart', 'contractDuration', 'commercialModel',
    'clientPoc', 'clientPocRole', 'clientEmail', 'clientPhone',
    'escalationContact', 'acquisitionOwner', 'assignedCsManager',
    'primaryObjectives', 'successMetrics', 'shortTermPriorities', 'longTermPriorities',
    'howTheyOperate', 'orderWorkflowSummary', 'locationsOperatingHours',
    'keyNeeds', 'topPainPoints',
    'currentSystemsUsed', 'requiredIntegrations',
    'inScope', 'outOfScope', 'dependenciesFromClient', 'highlights',
  ]
  const data = {}
  for (const key of allowed) {
    if (key in body) {
      if (key === 'contractStart') {
        data[key] = body[key] ? new Date(body[key]) : null
      } else {
        data[key] = body[key] || null
      }
    }
  }

  const updated = await prisma.handoverDocument.update({ where: { id: doc.id }, data })
  return NextResponse.json(updated)
}
