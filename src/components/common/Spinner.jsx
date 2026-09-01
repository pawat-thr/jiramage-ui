export default function Spinner({ label = 'Loading Jira issues…', className = 'py-20' }) {
  return (
    <div className={`grid place-items-center gap-3.5 text-muted ${className}`} data-spinner>
      <div className="size-7 animate-spin rounded-full border-[3px] border-line border-t-accent" />
      {label && <span>{label}</span>}
    </div>
  )
}
