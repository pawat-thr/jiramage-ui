// PR review statuses, with badge classes and a theme-aware accent color.
export const PR_STATUSES = [
  { id: 'open', label: 'Open', cls: 'bg-slate-soft text-slate border-line-strong', color: 'var(--color-slate)' },
  { id: 'in_review', label: 'In Review', cls: 'bg-blue-soft text-blue border-blue/50', color: 'var(--color-blue)' },
  {
    id: 'changes_requested',
    label: 'Changes Requested',
    cls: 'bg-amber-soft text-amber border-amber/50',
    color: 'var(--color-amber)',
  },
  { id: 'approved', label: 'Approved', cls: 'bg-success-soft text-success-bright border-success/50', color: 'var(--color-success)' },
  { id: 'merged', label: 'Merged', cls: 'bg-violet-soft text-violet border-violet/50', color: 'var(--color-violet)' },
]

export const statusMeta = (id) => PR_STATUSES.find((s) => s.id === id) || PR_STATUSES[0]

// Deterministic avatar color + initials from a name/email, for comments & reviewers.
const AVATAR_COLORS = ['#a78bfa', '#6cb0f0', '#3fb98a', '#e6b856', '#ff8a7a', '#8494ab']
export function avatarColor(key) {
  let h = 0
  for (const ch of key || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
export const initials = (name) => (name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()

// Timestamps come back as Firestore Timestamps (or null while a write is pending).
export const fmtTime = (ts) => {
  try {
    return ts?.toDate ? ts.toDate().toLocaleString() : '…'
  } catch {
    return '…'
  }
}
