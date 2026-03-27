'use client'
import { parseMentionsForRender } from '@/lib/mentions'

/**
 * Renders a note/comment body with @[Name](userId) tokens highlighted
 * as indigo-coloured mention chips.
 *
 * Props:
 *   content   string — the raw stored text (may contain @[Name](userId) tokens)
 *   className string — forwarded to the outer <p> element
 */
export function RenderedNote({ content, className = '' }) {
  const parts = parseMentionsForRender(content)
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) =>
        part.type === 'mention' ? (
          <span
            key={i}
            className="inline-block text-indigo-600 font-medium bg-indigo-50 rounded px-0.5 leading-snug"
          >
            @{part.name}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  )
}
