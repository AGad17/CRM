'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

/**
 * A textarea that supports @-mentions.
 *
 * Typing "@" opens a dropdown of team members. Selecting one inserts the token
 * @[Name](userId) into the text at the caret position.
 *
 * Props:
 *   value       string                         controlled value
 *   onChange    (newValue: string) => void
 *   placeholder string
 *   rows        number                         default 3
 *   className   string                         forwarded to <textarea>
 *   onKeyDown   (e: KeyboardEvent) => void     forwarded (for Cmd+Enter shortcuts)
 *   disabled    boolean
 */
export function MentionTextarea({
  value = '',
  onChange,
  placeholder = 'Write a note… use @ to mention a teammate',
  rows = 3,
  className = '',
  onKeyDown,
  disabled = false,
}) {
  const textareaRef = useRef(null)
  const dropdownRef = useRef(null)

  // ── @ detection state ──────────────────────────────────────────────────────
  const [mentionOpen,  setMentionOpen]  = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionAt,    setMentionAt]    = useState(-1)   // index of the '@' char
  const [activeIndex,  setActiveIndex]  = useState(0)    // keyboard navigation

  // ── Fetch team members (cached 5 min) ─────────────────────────────────────
  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staff-users'],
    queryFn:  () => fetch('/api/users/staff').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const filtered = staffUsers
    .filter((u) => {
      const display = (u.name || u.email || '').toLowerCase()
      return display.includes(mentionQuery.toLowerCase())
    })
    .slice(0, 8)

  // Reset active index when filtered list changes
  useEffect(() => { setActiveIndex(0) }, [mentionQuery])

  // Close dropdown on outside click
  useEffect(() => {
    if (!mentionOpen) return
    const handler = (e) => {
      if (
        textareaRef.current && !textareaRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setMentionOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mentionOpen])

  // ── Handle textarea change ─────────────────────────────────────────────────
  function handleChange(e) {
    const val   = e.target.value
    const caret = e.target.selectionStart ?? val.length

    // Scan backwards from caret for an un-closed '@'
    const beforeCaret = val.slice(0, caret)
    const atIndex     = beforeCaret.lastIndexOf('@')

    if (atIndex >= 0) {
      const query = beforeCaret.slice(atIndex + 1)
      // Only open if query has no spaces (a space after '@' means the user moved on)
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionAt(atIndex)
        setMentionQuery(query)
        setMentionOpen(true)
        onChange(val)
        return
      }
    }

    setMentionOpen(false)
    onChange(val)
  }

  // ── Insert mention token ───────────────────────────────────────────────────
  function selectUser(user) {
    const name    = user.name || user.email
    const token   = `@[${name}](${user.id}) `
    const before  = value.slice(0, mentionAt)
    const after   = value.slice(mentionAt + 1 + mentionQuery.length)
    const newValue = before + token + after

    onChange(newValue)
    setMentionOpen(false)

    // Restore focus and move caret to end of inserted token
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      const pos = before.length + token.length
      el.focus()
      el.setSelectionRange(pos, pos)
    }, 0)
  }

  // ── Keyboard navigation in dropdown ───────────────────────────────────────
  function handleKeyDown(e) {
    if (mentionOpen && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectUser(filtered[activeIndex])
        return
      }
      if (e.key === 'Escape') {
        setMentionOpen(false)
        return
      }
    }
    // Forward to parent (e.g. Cmd+Enter to save)
    onKeyDown?.(e)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
      />

      {mentionOpen && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-50 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden"
          style={{ bottom: 'auto', top: '100%' }}
        >
          <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
            Mention a teammate
          </p>
          {filtered.map((user, idx) => {
            const display = user.name || user.email
            const sub     = user.name ? user.email : null
            return (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectUser(user) }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                  idx === activeIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Avatar initials */}
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
                  {display.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">{display}</span>
                  {sub && <span className="block text-xs text-gray-400 truncate">{sub}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
