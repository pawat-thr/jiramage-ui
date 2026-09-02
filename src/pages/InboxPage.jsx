import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  watchInbox,
  markRead,
  markAllRead,
  deleteNotification,
} from '../services/notificationsApi.js'
import { notifMessage } from '../features/inbox/notifText.jsx'
import { avatarColor, initials, fmtTime } from '../features/pr/prConstants.js'
import { emailUsername } from '../utils/format.js'
import { card, cx, emptyState, toolbar } from '../utils/ui.js'

const TABS = [
  ['all', 'All'],
  ['unread', 'Unread'],
]

export default function InboxPage({ user, onNotify }) {
  const [items, setItems] = useState(null)
  const [tab, setTab] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.email) return
    return watchInbox(user.email, setItems, (err) => onNotify(err.message, true))
  }, [user?.email])

  const unread = (items || []).filter((n) => !n.read)
  const visible = tab === 'unread' ? unread : items || []

  const openItem = (n) => {
    if (!n.read) markRead(n.id).catch(() => {})
    navigate(`/pr-review/${n.refId}`)
  }

  const remove = (e, n) => {
    e.stopPropagation()
    deleteNotification(n.id).catch((err) => onNotify(err.message, true))
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className={toolbar}>
        <div className="inline-flex rounded-xl border border-line bg-field p-1">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={cx(
                'rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors',
                tab === id ? 'bg-accent-soft text-accent-bright' : 'text-ink-soft hover:text-ink',
              )}
              onClick={() => setTab(id)}
            >
              {label}
              {id === 'unread' && unread.length > 0 && ` (${unread.length})`}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {unread.length > 0 && (
          <button
            className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-accent hover:text-accent-bright"
            onClick={() => markAllRead(unread.map((n) => n.id)).catch(() => {})}
          >
            Mark all read
          </button>
        )}
      </div>

      <div className={card}>
        {items === null ? (
          <div className={emptyState}>Loading inbox…</div>
        ) : visible.length === 0 ? (
          <div className={emptyState}>
            {tab === 'unread'
              ? 'No unread notifications — all caught up. ✓'
              : 'Nothing here yet — you’ll see reviews, status changes, and comments on your PRs.'}
          </div>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              onClick={() => openItem(n)}
              className={cx(
                'group flex cursor-pointer items-start gap-4 border-b border-line px-5 py-4 transition-colors last:border-b-0 hover:bg-panel-soft',
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
                <span className="mt-0.5 block text-xs text-muted">{fmtTime(n.createdAt)}</span>
              </span>
              {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" />}
              <button
                aria-label="Delete notification"
                title="Delete"
                className="mt-1 grid size-7 shrink-0 place-items-center rounded-full text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                onClick={(e) => remove(e, n)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
