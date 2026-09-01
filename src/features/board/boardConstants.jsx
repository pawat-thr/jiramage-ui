// Team Board task statuses.
export const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', cls: 'bg-slate-soft text-slate border-line-strong', color: 'var(--color-slate)' },
  { id: 'in_progress', label: 'In Progress', cls: 'bg-blue-soft text-blue border-blue/50', color: 'var(--color-blue)' },
  { id: 'waiting', label: 'Waiting', cls: 'bg-amber-soft text-amber border-amber/50', color: 'var(--color-amber)' },
  { id: 'wait_migrate', label: 'Wait Migrate', cls: 'bg-violet-soft text-violet border-violet/50', color: 'var(--color-violet)' },
  { id: 'done', label: 'Done', cls: 'bg-success-soft text-success-bright border-success/50', color: 'var(--color-success)' },
]

export const taskStatusMeta = (id) => TASK_STATUSES.find((s) => s.id === id) || TASK_STATUSES[0]

export const ENVS = ['1', '2', '3']

export function TaskStatusBadge({ status }) {
  const s = taskStatusMeta(status)
  return (
    <span className={`inline-block rounded-full border px-2.5 py-[3px] text-xs font-medium whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}
