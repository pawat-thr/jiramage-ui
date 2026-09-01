// PR review statuses, with badge classes and a chart-safe color var.
export const PR_STATUSES = [
  { id: 'open', label: 'Open', cls: 'bg-slate-soft text-slate border-line-strong' },
  { id: 'in_review', label: 'In Review', cls: 'bg-blue-soft text-blue border-blue/50' },
  {
    id: 'changes_requested',
    label: 'Changes Requested',
    cls: 'bg-amber-soft text-amber border-amber/50',
  },
  { id: 'approved', label: 'Approved', cls: 'bg-success-soft text-success-bright border-success/50' },
  { id: 'merged', label: 'Merged', cls: 'bg-violet-soft text-violet border-violet/50' },
]

export const statusMeta = (id) => PR_STATUSES.find((s) => s.id === id) || PR_STATUSES[0]

// Timestamps come back as Firestore Timestamps (or null while a write is pending).
export const fmtTime = (ts) => {
  try {
    return ts?.toDate ? ts.toDate().toLocaleString() : '…'
  } catch {
    return '…'
  }
}
