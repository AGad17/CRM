import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requirePermission } from '@/lib/roleGuard'
import { getLeadComments, createLeadComment } from '@/lib/db/leadComments'
import { parseMentions } from '@/lib/mentions'
import { createNotification } from '@/lib/db/notifications'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const { error } = await requirePermission('pipeline', 'view')
  if (error) return error

  const { id } = await params
  const comments = await getLeadComments(id)
  return NextResponse.json({ comments })
}

export async function POST(request, { params }) {
  const { error } = await requirePermission('pipeline', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const session = await getServerSession(authOptions)
  const authorId   = session?.user?.id
  const authorName = session?.user?.name || session?.user?.email || 'Someone'

  const comment = await createLeadComment({
    leadId:   Number(id),
    authorId,
    content:  body.content.trim(),
  })

  // Fire @mention notifications (in-app + email via createNotification)
  const mentions = parseMentions(body.content)
  if (mentions.length) {
    const lead = await prisma.lead.findUnique({ where: { id: Number(id) }, select: { companyName: true } })
    const leadName = lead?.companyName || 'a lead'
    for (const { userId } of mentions) {
      if (userId !== authorId) {
        await createNotification({
          userId,
          type:  'MentionInLeadComment',
          title: `${authorName} mentioned you in a comment on "${leadName}"`,
          body:  body.content.slice(0, 120),
          link:  `/pipeline?lead=${id}&comment=${comment.id}`,
        })
      }
    }
  }

  return NextResponse.json(comment, { status: 201 })
}
