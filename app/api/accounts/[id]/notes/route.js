import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requirePermission } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/db/notifications'
import { parseMentions } from '@/lib/mentions'

export async function GET(request, { params }) {
  const { error } = await requirePermission('accounts', 'view')
  if (error) return error

  const { id } = await params
  const notes = await prisma.accountNote.findMany({
    where: { accountId: Number(id) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(notes)
}

export async function POST(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const session = await getServerSession(authOptions)
  const note = await prisma.accountNote.create({
    data: {
      accountId:  Number(id),
      content:    body.content.trim(),
      authorId:   session?.user?.id   || null,
      authorName: session?.user?.name || session?.user?.email || null,
    },
  })
  // @mention notifications
  const actorName = session?.user?.name || session?.user?.email || 'Someone'
  const mentions = parseMentions(body.content)
  if (mentions.length) {
    const account = await prisma.account.findUnique({ where: { id: Number(id) }, select: { name: true } })
    const accountName = account?.name || 'an account'
    for (const { userId } of mentions) {
      if (userId !== session?.user?.id) {
        await createNotification({
          userId,
          type:  'UserMentioned',
          title: `${actorName} mentioned you in a note on "${accountName}"`,
          body:  body.content.slice(0, 120),
          link:  `/accounts/${id}#note-${note.id}`,
        })
      }
    }
  }
  return NextResponse.json(note, { status: 201 })
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission('accounts', 'edit')
  if (error) return error

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const noteId = searchParams.get('noteId')
  if (!noteId) return NextResponse.json({ error: 'noteId is required' }, { status: 400 })

  await prisma.accountNote.delete({ where: { id: Number(noteId), accountId: Number(id) } })
  return NextResponse.json({ ok: true })
}
