import { prisma } from '@/lib/prisma'

/**
 * Returns all comments for a lead, oldest first, with author name.
 * @param {number} leadId
 */
export async function getLeadComments(leadId) {
  return prisma.leadComment.findMany({
    where:   { leadId: Number(leadId) },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true, email: true } } },
  })
}

/**
 * Creates a new comment on a lead.
 * @param {{ leadId: number, authorId: string, content: string }}
 */
export async function createLeadComment({ leadId, authorId, content }) {
  return prisma.leadComment.create({
    data: { leadId: Number(leadId), authorId, content },
    include: { author: { select: { id: true, name: true, email: true } } },
  })
}
