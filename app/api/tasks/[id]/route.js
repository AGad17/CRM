import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getTask, updateTask, deleteTask } from '@/lib/db/tasks'
import { createNotification } from '@/lib/db/notifications'

export async function PATCH(request, { params }) {
  const { error, session } = await requirePermission('tasks', 'edit')
  if (error) return error

  const { id } = await params
  const body   = await request.json()

  const existing = await getTask(id)
  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Only assignee, creator, or admin can edit
  const isAdmin   = session.user.role === 'CCO_ADMIN'
  const isOwner   = existing.assignedToId === session.user.id || existing.createdById === session.user.id
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const task = await updateTask(id, body)

  // Notify new assignee if reassigned to someone else
  if (body.assignedToId && body.assignedToId !== existing.assignedToId && body.assignedToId !== session.user.id) {
    const actorName = session.user.name || session.user.email
    await createNotification({
      userId: body.assignedToId,
      type:   'TaskAssigned',
      title:  `${actorName} assigned you a task: "${task.title}"`,
      link:   `/tasks?highlight=${task.id}`,
    })
  }

  return NextResponse.json(task)
}

export async function DELETE(request, { params }) {
  const { error, session } = await requirePermission('tasks', 'delete')
  if (error) return error

  const { id } = await params

  const existing = await getTask(id)
  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const isAdmin = session.user.role === 'CCO_ADMIN'
  const isOwner = existing.assignedToId === session.user.id || existing.createdById === session.user.id
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await deleteTask(id)
  return NextResponse.json({ ok: true })
}
