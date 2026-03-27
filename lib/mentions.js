/**
 * Mention utilities — safe to import in both API routes and 'use client' components.
 *
 * Token format stored in DB:  @[Name](userId)
 * Example:                    @[Ahmed Gad](clxxx123)
 */

// ─── Regex ────────────────────────────────────────────────────────────────────

// NOTE: Always construct a fresh RegExp per call — reusing a /g regex with
// exec() carries stateful lastIndex that causes skipped matches on re-use.
const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g

// ─── Server-side helpers ──────────────────────────────────────────────────────

/**
 * Extract all unique mentioned users from a piece of text.
 * @param {string | null | undefined} text
 * @returns {{ name: string, userId: string }[]}
 */
export function parseMentions(text) {
  if (!text) return []
  const mentions = []
  const seen = new Set()
  const re = new RegExp(MENTION_PATTERN.source, 'g')
  let match
  while ((match = re.exec(text)) !== null) {
    const [, name, userId] = match
    if (!seen.has(userId)) {
      seen.add(userId)
      mentions.push({ name, userId })
    }
  }
  return mentions
}

// ─── Client-side helpers ──────────────────────────────────────────────────────

/**
 * Split text into renderable segments: plain text or mention tokens.
 * @param {string | null | undefined} text
 * @returns {Array<
 *   { type: 'text', value: string } |
 *   { type: 'mention', value: string, name: string, userId: string }
 * >}
 */
export function parseMentionsForRender(text) {
  if (!text) return [{ type: 'text', value: '' }]
  const parts = []
  const re = new RegExp(MENTION_PATTERN.source, 'g')
  let lastIndex = 0
  let match
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mention', value: match[0], name: match[1], userId: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts.length ? parts : [{ type: 'text', value: text }]
}
