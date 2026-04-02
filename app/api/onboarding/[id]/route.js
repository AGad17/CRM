import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requirePermission } from '@/lib/roleGuard'
import { getOnboardingTracker, advancePhase, setPhase, addNote, assignAccountManager, assignOnboardingTeam } from '@/lib/db/onboarding'
import { logActivity } from '@/lib/activityLog'
import { createNotification, createNotifications } from '@/lib/db/notifications'
import { parseMentions } from '@/lib/mentions'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const { error } = await requirePermission('onboarding', 'view')
  if (error) return error

  const { id } = await params
  const tracker = await getOnboardingTracker(id)
  if (!tracker) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tracker)
}

export async function PATCH(request, { params }) {
  const { error } = await requirePermission('onboarding', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const session = await getServerSession(authOptions)
  const actor = { actorId: session?.user?.id, actorName: session?.user?.name || session?.user?.email }

  try {
    if (body.action === 'advance') {
      const before  = await getOnboardingTracker(id)
      const tracker = await advancePhase(id)
      await logActivity({
        entity: 'Tracker', entityId: Number(id), accountId: before?.accountId, action: 'phase_advanced',
        ...actor,
        meta: { from: before?.phase, to: tracker.phase },
      })
      return NextResponse.json(tracker)
    }

    if (body.action === 'setPhase') {
      if (!body.phase) return NextResponse.json({ error: 'phase is required' }, { status: 400 })
      const before = await getOnboardingTracker(id)
      const assignments = {
        onboardingSpecialistId: body.onboardingSpecialistId,
        trainingSpecialistId:   body.trainingSpecialistId,
        accountManagerId:       body.accountManagerId,
        churnReason:            body.churnReason,
        churnNote:              body.churnNote,
      }
      const tracker = await setPhase(id, body.phase, assignments)
      await logActivity({
        entity: 'Tracker', entityId: Number(id), accountId: before?.accountId, action: 'phase_changed',
        ...actor,
        meta: { from: before?.phase, to: body.phase },
      })
      return NextResponse.json(tracker)
    }

    if (body.action === 'notes') {
      if (!body.content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })
      const author   = session?.user?.name || session?.user?.email || null
      const authorId = session?.user?.id || null
      const note     = await addNote(id, body.content.trim(), author, authorId)
      // @mention notifications
      const mentions = parseMentions(body.content)
      if (mentions.length) {
        const tracker = await prisma.onboardingTracker.findUnique({
          where: { id: Number(id) }, select: { account: { select: { name: true } } },
        })
        const accountName = tracker?.account?.name || 'an account'
        for (const { userId } of mentions) {
          if (userId !== session?.user?.id) {
            await createNotification({
              userId,
              type:  'UserMentioned',
              title: `${author || 'Someone'} mentioned you in an Onboarding note for "${accountName}"`,
              body:  body.content.slice(0, 120),
              link:  `/onboarding/${id}#note-${note.id}`,
            })
          }
        }
      }
      return NextResponse.json(note)
    }

    if (body.action === 'assign') {
      const tracker = await assignAccountManager(id, body.accountManagerId)
      // Notify the newly assigned account manager
      if (body.accountManagerId && body.accountManagerId !== session?.user?.id) {
        const accountName = tracker?.account?.name || 'an account'
        await createNotification({
          userId: body.accountManagerId,
          type:   'CaseAssigned',
          title:  `${actor.actorName} assigned you as Account Manager for "${accountName}"`,
          link:   `/onboarding/${id}`,
        })
      }
      return NextResponse.json(tracker)
    }

    if (body.action === 'assignTeam') {
      const tracker = await assignOnboardingTeam(id, {
        onboardingSpecialistId: body.onboardingSpecialistId,
        trainingSpecialistId:   body.trainingSpecialistId,
      })
      // Notify newly assigned team members
      const accountName = tracker?.account?.name || 'an account'
      const assignees = [body.onboardingSpecialistId, body.trainingSpecialistId]
        .filter(Boolean)
        .filter((uid) => uid !== session?.user?.id)
      if (assignees.length) {
        await createNotifications(assignees, {
          type:  'CaseAssigned',
          title: `${actor.actorName} assigned you to the Onboarding team for "${accountName}"`,
          link:  `/onboarding/${id}`,
        })
      }
      return NextResponse.json(tracker)
    }

    if (body.action === 'voidNote') {
      if (!body.noteId) return NextResponse.json({ error: 'noteId is required' }, { status: 400 })
      const existing = await prisma.onboardingNote.findUnique({ where: { id: Number(body.noteId) } })
      if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
      if (existing.voidedAt) return NextResponse.json({ error: 'Note is already voided' }, { status: 400 })
      const isAuthor = existing.authorId && existing.authorId === session?.user?.id
      const isAdmin  = session?.user?.role === 'CCO_ADMIN'
      if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const note = await prisma.onboardingNote.update({
        where: { id: Number(body.noteId) },
        data:  { voidedAt: new Date(), voidedById: session.user.id, voidedByName: session.user.name || session.user.email },
      })
      return NextResponse.json(note)
    }

    return NextResponse.json({ error: 'action must be advance, setPhase, assign, assignTeam, notes, or voidNote' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
