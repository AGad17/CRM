import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import {
  getCase,
  updateCase,
  updateCaseStatus,
  addFollowUp,
  deleteCase,
} from '@/lib/db/engagementCases'

export async function GET(request, { params }) {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const c = await getCase(params.id)
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(c)
}

export async function PATCH(request, { params }) {
  const { error, session } = await requirePermission('cases', 'edit')
  if (error) return error

  const body = await request.json()

  if (body.action === 'updateStatus') {
    if (!body.status) return NextResponse.json({ error: 'status is required' }, { status: 400 })
    const c = await updateCaseStatus(params.id, body.status)
    return NextResponse.json(c)
  }

  if (body.action === 'update') {
    const c = await updateCase(params.id, body)
    return NextResponse.json(c)
  }

  if (body.action === 'addFollowUp') {
    if (!body.loggedAt) return NextResponse.json({ error: 'loggedAt is required' }, { status: 400 })
    const fu = await addFollowUp(params.id, body, session.user.id)
    return NextResponse.json(fu, { status: 201 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('cases', 'delete')
  if (error) return error

  await deleteCase(params.id)
  return NextResponse.json({ success: true })
}
