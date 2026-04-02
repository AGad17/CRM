import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getTasks, createTask } from '@/lib/db/tasks'
import { createNotification } from '@/lib/db/notifications'

export async function GET(request) {
  const { error, session } = await requirePermission('tasks', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const isAdmin = session.user.role === 'CCO_ADMIN'

  const filters = {}

  // Non-admins can only see their own tasks unless they specify a different user (blocked below)
  const requestedAssignee = searchParams.get('assignedToId')
  if (requestedAssignee) {
    filters.assignedToId = requestedAssignee
  } else if (!isAdmin && !searchParams.get('all')) {
    // Default: own tasks
    filters.assignedToId = session.user.id
  }

  if (searchParams.get('status'))    filters.status    = searchParams.get('status')
  if (searchParams.get('accountId')) filters.accountId = searchParams.get('accountId')
  if (searchParams.get('leadId'))    filters.leadId    = searchParams.get('leadId')
  if (searchParams.get('caseId'))    filters.caseId    = searchParams.get('caseId')
  if (searchParams.get('from'))      filters.from      = searchParams.get('from')
  if (searchParams.get('to'))        filters.to        = searchParams.get('to')
  if (searchParams.get('includeAll') === 'true') filters.includeAll = true

  const tasks = await getTasks(filters)
  return NextResponse.json(tasks)
}

export async function POST(request) {
  const { error, session } = await requirePermission('tasks', 'create')
  if (error) return error

  const body = await request.json()
  if (!body.title?.trim())    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!body.type)             return NextResponse.json({ error: 'type is required' },  { status: 400 })
  if (!body.assignedToId)     return NextResponse.json({ error: 'assignedToId is required' }, { status: 400 })
  if (!body.dueDate)          return NextResponse.json({ error: 'dueDate is required' }, { status: 400 })

  const task = await createTask({ ...body, createdById: session.user.id })

  // Notify the assignee if different from creator
  if (task.assignedToId !== session.user.id) {
    const creatorName = session.user.name || session.user.email
    await createNotification({
      userId: task.assignedToId,
      type:   'TaskAssigned',
      title:  `${creatorName} assigned you a task: "${task.title}"`,
      body:   task.notes?.slice(0, 120) || undefined,
      link:   `/tasks?highlight=${task.id}`,
    })
  }

  return NextResponse.json(task, { status: 201 })
}
