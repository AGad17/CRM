import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { toggleTask } from '@/lib/db/onboarding'

export async function PATCH(request, { params }) {
  const { error } = await requireAuth('ops')
  if (error) return error

  const { taskId } = await params

  try {
    const task = await toggleTask(taskId)
    return NextResponse.json(task)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
