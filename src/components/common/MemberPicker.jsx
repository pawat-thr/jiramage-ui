import { useMemo, useState } from 'react'
import { avatarColor, initials } from '../../features/pr/prConstants.js'
import { emailUsername } from '../../utils/format.js'
import { cx } from '../../utils/ui.js'

// Show the filter box once the team is big enough that scanning pills gets slow.
const FILTER_AT = 8

// Multi-select member picker that stays usable with 20+ members:
// selected chips on top (with quick remove), a filter box, and a
// scrollable pill list below.
export default function MemberPicker({ members, selected, onToggle, emptyHint = 'Nobody picked yet — click below to add.' }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? members.filter((e) => e.toLowerCase().includes(t)) : members
  }, [members, q])

  return (
    <div className="grid gap-2">
      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        {selected.length === 0 ? (
          <span className="text-xs text-muted">{emptyHint}</span>
        ) : (
          <>
            <span className="text-xs text-muted tabular-nums">{selected.length} picked:</span>
            {selected.map((email) => (
              <span
                key={email}
                className="flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft py-0.5 pr-1 pl-1 text-[13px] text-accent-bright"
              >
                <span
                  className="grid size-4.5 place-items-center rounded-full text-[9px] font-bold text-bg"
                  style={{ background: avatarColor(email) }}
                >
                  {initials(emailUsername(email))}
                </span>
                {emailUsername(email)}
                <button
                  type="button"
                  className="grid size-4 place-items-center rounded-full text-muted hover:text-danger"
                  onClick={() => onToggle(email)}
                  aria-label={`Remove ${emailUsername(email)}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {selected.length > 1 && (
              <button
                type="button"
                className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline"
                onClick={() => selected.forEach((e) => onToggle(e))}
              >
                clear all
              </button>
            )}
          </>
        )}
      </div>

      {members.length >= FILTER_AT && (
        <input
          className="w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted"
          placeholder={`Filter ${members.length} members…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      <div className="flex max-h-32 flex-wrap content-start gap-1.5 overflow-y-auto rounded-xl border border-line bg-panel-soft p-2">
        {filtered.length === 0 && (
          <span className="px-1 py-0.5 text-[13px] text-muted">No member matches “{q.trim()}”.</span>
        )}
        {filtered.map((email) => {
          const active = selected.includes(email)
          return (
            <button
              type="button"
              key={email}
              className={cx(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-colors',
                active
                  ? 'border-accent bg-accent-soft text-accent-bright'
                  : 'border-line bg-field text-ink-soft hover:border-line-strong',
              )}
              onClick={() => onToggle(email)}
            >
              <span
                className="grid size-4.5 place-items-center rounded-full text-[9px] font-bold text-bg"
                style={{ background: avatarColor(email) }}
              >
                {initials(emailUsername(email))}
              </span>
              {emailUsername(email)}
              {active && <span aria-hidden>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
