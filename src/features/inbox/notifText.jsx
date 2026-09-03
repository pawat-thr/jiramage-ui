import { avatarColor, initials, fmtTime } from '../pr/prConstants.js'
import { emailUsername } from '../../utils/format.js'

// Human-readable message for one notification, shared by the bell dropdown
// and the Inbox page.
export function notifMessage(n) {
  switch (n.type) {
    case 'pr_status_changed':
      return (
        <>
          changed your PR status to <strong>{n.statusLabel || '…'}</strong>
        </>
      )
    case 'pr_comment':
      return 'commented on your PR'
    default:
      return 'assigned you to review'
  }
}

// Avatar + message + title + time — the shared body of a notification row.
export function NotifBody({ n }) {
  const who = n.fromName || emailUsername(n.fromEmail)
  return (
    <>
      <span
        className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-bg"
        style={{ background: avatarColor(n.fromEmail) }}
      >
        {initials(who)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">
          <strong>{who}</strong> {notifMessage(n)}
        </span>
        <span className="block truncate text-sm font-medium text-accent-bright">{n.title}</span>
        <span className="mt-0.5 block text-xs text-muted">{fmtTime(n.createdAt)}</span>
      </span>
    </>
  )
}
