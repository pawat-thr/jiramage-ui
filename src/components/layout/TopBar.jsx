import { CFG, APP_VERSION, APP_CREDIT } from '../../config/appConfig.js'

function IconButton({ label, onClick, children, className = '' }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`grid size-10 place-items-center rounded-full border border-line bg-panel text-ink-soft transition-colors hover:border-line-strong hover:text-ink ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function TopBar({ title, updatedAt, user, onLogout, onToggleCollapse, onToggleMobile }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-[68px] items-center gap-3 border-b border-line bg-bg/92 px-4 py-3 backdrop-blur-md md:px-6">
      {/* mobile: open drawer */}
      <IconButton label="Open menu" onClick={onToggleMobile} className="md:hidden">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </IconButton>
      {/* desktop: collapse rail */}
      <IconButton label="Toggle sidebar" onClick={onToggleCollapse} className="max-md:hidden">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="M9.5 4.5v15" />
        </svg>
      </IconButton>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        <span className="block text-xs text-muted max-md:hidden">
          Jira dashboard · {APP_VERSION} · {APP_CREDIT}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        {CFG.projects.length > 0 && (
          <span className="rounded-full border border-line bg-accent-soft px-2.5 py-[3px] font-semibold text-accent-bright">
            {CFG.projects.join(', ')}
          </span>
        )}
        <span className="max-md:hidden">
          {updatedAt && <>updated {updatedAt.toLocaleTimeString()} · </>}
          auto-refresh {Math.round(CFG.refreshMs / 60000)}m
        </span>
        {user && (
          <span className="flex items-center gap-2 border-l border-line pl-3">
            <span className="max-w-[140px] truncate font-medium text-ink-soft" title={user.email}>
              {user.name}
            </span>
            {onLogout && (
              <button
                className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-danger hover:text-danger"
                onClick={onLogout}
              >
                Sign out
              </button>
            )}
          </span>
        )}
      </div>
    </header>
  )
}
