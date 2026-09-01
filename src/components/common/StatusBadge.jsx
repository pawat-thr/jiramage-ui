// Jira convention: To Do = neutral, In Progress = blue, Done = green.
const CATEGORY_CLASSES = {
  new: 'bg-slate-soft text-slate border-line-strong',
  indeterminate: 'bg-blue-soft text-blue border-blue/50',
  done: 'bg-success-soft text-success-bright border-success/50',
}

export default function StatusBadge({ status }) {
  const cat = status.statusCategory?.key || 'new'
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-[3px] text-xs font-medium whitespace-nowrap ${
        CATEGORY_CLASSES[cat] || CATEGORY_CLASSES.new
      }`}
    >
      {status.name}
    </span>
  )
}
