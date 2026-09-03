import { useRef, useState } from 'react'
import { CFG } from '../../config/appConfig.js'
import { emailUsername } from '../../utils/format.js'
import { avatarColor, initials } from './prConstants.js'
import { cx } from '../../utils/ui.js'

// Everyone who can be @mentioned: the whole team, addressed by email username
// (e.g. @tanawat.k for tanawat.k@orbitdigital.co.th).
const MENTIONABLE = [CFG.email, ...CFG.teamEmails].map((email) => ({
  email,
  name: emailUsername(email),
}))

const MENTION_RE = /@([a-z0-9][a-z0-9._-]*)/gi

// Emails of members @mentioned in a comment body.
export function extractMentionEmails(text) {
  const found = new Set()
  for (const m of (text || '').matchAll(MENTION_RE)) {
    const hit = MENTIONABLE.find((o) => o.name.toLowerCase() === m[1].toLowerCase())
    if (hit) found.add(hit.email)
  }
  return [...found]
}

// Comment body with real @mentions highlighted.
export function MentionText({ text }) {
  const parts = []
  let last = 0
  for (const m of (text || '').matchAll(MENTION_RE)) {
    const isMember = MENTIONABLE.some((o) => o.name.toLowerCase() === m[1].toLowerCase())
    if (!isMember) continue
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <span key={m.index} className="rounded bg-accent-soft px-1 font-medium text-accent-bright">
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

// Textarea with @mention autocomplete: type "@" to get a member dropdown,
// arrows/Enter/Tab to pick, Esc to dismiss. ⌘/Ctrl+Enter still posts.
export function MentionTextarea({ value, setValue, onPost, disabled, placeholder, className }) {
  const ref = useRef(null)
  const [sug, setSug] = useState(null) // { query, start } — start = index right after "@"
  const [idx, setIdx] = useState(0)

  const options = sug
    ? MENTIONABLE.filter((o) => o.name.toLowerCase().startsWith(sug.query)).slice(0, 6)
    : []

  const refresh = (el) => {
    const upto = el.value.slice(0, el.selectionStart)
    const m = /(^|[\s(])@([a-z0-9._-]*)$/i.exec(upto)
    if (m) {
      setSug({ query: m[2].toLowerCase(), start: el.selectionStart - m[2].length })
      setIdx(0)
    } else {
      setSug(null)
    }
  }

  const pick = (o) => {
    const el = ref.current
    const next = value.slice(0, sug.start) + o.name + ' ' + value.slice(el.selectionStart)
    setValue(next)
    setSug(null)
    const caret = sug.start + o.name.length + 1
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  const onKeyDown = (e) => {
    if (options.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIdx((i) => (i + 1) % options.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIdx((i) => (i - 1 + options.length) % options.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pick(options[idx])
        return
      }
      if (e.key === 'Escape') {
        setSug(null)
        return
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onPost(e)
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className={className}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value)
          refresh(e.target)
        }}
        onKeyDown={onKeyDown}
        onClick={(e) => refresh(e.target)}
        onBlur={() => setTimeout(() => setSug(null), 150)}
      />
      {options.length > 0 && (
        <div className="absolute bottom-full left-3 z-30 mb-1 max-h-56 w-60 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-xl border border-line bg-panel shadow-lift">
          {options.map((o, i) => (
            <button
              type="button"
              key={o.email}
              className={cx(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                i === idx ? 'bg-accent-soft text-accent-bright' : 'text-ink-soft hover:bg-panel-soft',
              )}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault() // keep textarea focus
                pick(o)
              }}
            >
              <span
                className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-bg"
                style={{ background: avatarColor(o.email) }}
              >
                {initials(o.name)}
              </span>
              @{o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
