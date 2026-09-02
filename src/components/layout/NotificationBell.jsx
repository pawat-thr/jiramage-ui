import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { watchInbox, markRead, markAllRead } from '../../services/notificationsApi.js'
import { avatarColor, initials, fmtTime } from '../../features/pr/prConstants.js'
import { emailUsername } from '../../utils/format.js'
import { cx } from '../../utils/ui.js'

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

// In-app inbox: a bell with an unread badge. No push — users see it on login,
// and the badge updates live (Firestore listener) while the app is open.
export default function NotificationBell({ user }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.email) return
    return watchInbox(user.email, setItems, () => {}) // rules not published yet → empty inbox
  }, [user?.email])

  const unread = items.filter((n) => !n.read)

  const openItem = (n) => {
    setOpen(false)
    if (!n.read) markRead(n.id).catch(() => {})
    navigate(`/pr-review/${n.refId}`)
  }

  return (
    <div className="relative">
      <button
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}
        title="Notifications"
        className={cx(
          'relative grid size-10 place-items-center rounded-full border transition-colors',
          open
            ? 'border-accent bg-accent-soft text-accent-bright'
            : 'border-line bg-panel text-ink-soft hover:border-line-strong hover:text-ink',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[340px] max-w-[85vw] overflow-hidden rounded-2xl border border-line bg-panel shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold">
                Inbox{unread.length > 0 && <span className="text-muted"> · {unread.length} new</span>}
              </span>
              {unread.length > 0 && (
                <button
                  className="text-xs text-accent-bright hover:underline"
                  onClick={() => markAllRead(unread.map((n) => n.id)).catch(() => {})}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-muted">
                  Nothing here yet — you’ll see it when someone assigns you a review.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={cx(
                      'flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-panel-soft',
                      !n.read && 'bg-accent-soft/40',
                    )}
                  >
                    <span
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-bg"
                      style={{ background: avatarColor(n.fromEmail) }}
                    >
                      {initials(n.fromName || emailUsername(n.fromEmail))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink">
                        <strong>{n.fromName || emailUsername(n.fromEmail)}</strong> assigned you to
                        review
                      </span>
                      <span className="block truncate text-[13px] font-medium text-accent-bright">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {fmtTime(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
