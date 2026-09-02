import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { watchInbox, markRead, markAllRead } from '../../services/notificationsApi.js'
import { notifMessage } from '../../features/inbox/notifText.jsx'
import { avatarColor, initials, fmtTime } from '../../features/pr/prConstants.js'
import { APP_NAME, CFG } from '../../config/appConfig.js'
import { emailUsername } from '../../utils/format.js'
import { playPing } from '../../utils/notifSound.js'
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

  // Ids we've already pinged for — so reconnects/re-renders don't re-ping.
  const seenIds = useRef(null)

  useEffect(() => {
    if (!user?.email) return
    return watchInbox(
      user.email,
      (list) => {
        setItems(list)
        const unreadNow = list.filter((n) => !n.read)
        if (seenIds.current === null) {
          // First snapshot after load/refresh: one ping if anything is unread
          // (browser may defer it to the first click — handled in playPing).
          if (unreadNow.length > 0) playPing()
        } else if (unreadNow.some((n) => !seenIds.current.has(n.id))) {
          // A brand-new notification arrived while the app is open.
          playPing()
        }
        seenIds.current = new Set(list.map((n) => n.id))
      },
      (err) => console.warn('[notify] inbox read failed (rules published?):', err.message),
    )
  }, [user?.email])

  const unread = items.filter((n) => !n.read)

  // Tab title badge: "(3) jiramage" — visible even when sound is blocked/muted.
  useEffect(() => {
    document.title = unread.length ? `(${unread.length}) ${APP_NAME}` : APP_NAME
    return () => {
      document.title = APP_NAME
    }
  }, [unread.length])

  // Reminder nag: every REFRESH_INTERVAL, a softer ping while unread remain.
  useEffect(() => {
    if (!unread.length) return
    const t = setInterval(() => playPing(true), CFG.refreshMs)
    return () => clearInterval(t)
  }, [unread.length > 0])

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
          <span className="absolute -top-1.5 -right-1.5 grid min-w-[22px] animate-pop place-items-center rounded-full border-2 border-bg bg-accent px-1 py-0.5 text-xs font-bold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[440px] max-w-[90vw] overflow-hidden rounded-2xl border border-line bg-panel shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <span className="text-base font-semibold">
                Inbox{unread.length > 0 && <span className="text-muted"> · {unread.length} new</span>}
              </span>
              {unread.length > 0 && (
                <button
                  className="text-[13px] text-accent-bright hover:underline"
                  onClick={() => markAllRead(unread.map((n) => n.id)).catch(() => {})}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[440px] overflow-y-auto">
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
                      'flex w-full items-start gap-3.5 border-b border-line px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-panel-soft',
                      !n.read && 'bg-accent-soft/40',
                    )}
                  >
                    <span
                      className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-bg"
                      style={{ background: avatarColor(n.fromEmail) }}
                    >
                      {initials(n.fromName || emailUsername(n.fromEmail))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">
                        <strong>{n.fromName || emailUsername(n.fromEmail)}</strong> {notifMessage(n)}
                      </span>
                      <span className="block truncate text-sm font-medium text-accent-bright">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {fmtTime(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" />}
                  </button>
                ))
              )}
            </div>
            <button
              className="block w-full border-t border-line px-5 py-3 text-center text-[13px] font-medium text-accent-bright transition-colors hover:bg-panel-soft"
              onClick={() => {
                setOpen(false)
                navigate('/inbox')
              }}
            >
              View all in Inbox →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
