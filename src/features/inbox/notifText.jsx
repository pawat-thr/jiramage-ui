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
