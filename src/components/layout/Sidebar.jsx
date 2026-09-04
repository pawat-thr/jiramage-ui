import { APP_NAME, APP_VERSION, APP_COPYRIGHT } from '../../config/appConfig.js'
import { cx } from '../../utils/ui.js'

const ICONS = {
  dashboard: (
    <path d="M4 13h6V4H4zM4 20h6v-5H4zM14 20h6v-9h-6zM14 4v5h6V4z" />
  ),
  my: <path d="M20 6 9 17l-5-5" />,
  team: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.8 14.7c2.2.7 3.7 2.3 3.7 5.3" />
    </>
  ),
  pr: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M6 8.5v7M18 18.5v-8a4 4 0 0 0-4-4h-3" />
      <path d="m13 3.5-2.5 3 2.5 3" />
      <circle cx="18" cy="18" r="2.5" />
    </>
  ),
  delivery: (
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
    </>
  ),
  gen: (
    <>
      <path d="M6 21 21 6l-3-3L3 18z" />
      <path d="m14 7 3 3M9 3v2M5 5l1.4 1.4M3 9h2M19 13v2M17 17l1.5 1.5" />
    </>
  ),
  board: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1.2" />
      <rect x="9.5" y="4" width="5" height="10" rx="1.2" />
      <rect x="15.5" y="4" width="5" height="7" rx="1.2" />
    </>
  ),
  integration: (
    <>
      <circle cx="5.5" cy="12" r="2.5" />
      <circle cx="18.5" cy="5.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
      <path d="M7.8 10.8 16.2 6.7M7.8 13.2l8.4 4.1" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 14h4.5l1.5 2.5h4l1.5-2.5H20" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
}

function NavIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  )
}

export default function Sidebar({ items, active, onSelect, collapsed, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-backdrop md:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={cx(
          'z-40 flex h-dvh flex-col border-r border-line bg-panel transition-all duration-200',
          // desktop: sticky rail, collapsible width
          'md:sticky md:top-0 md:translate-x-0',
          collapsed ? 'md:w-[68px]' : 'md:w-60',
          // mobile: off-canvas drawer
          'fixed inset-y-0 left-0 w-60 max-md:transition-transform',
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        <div className={cx('flex h-[68px] items-center gap-2.5 border-b border-line', collapsed ? 'md:justify-center md:px-0 px-5' : 'px-5')}>
          <img src="/logo.png" alt="jiramage logo" className="size-8 shrink-0 rounded-lg object-contain" />
          <span className={cx('text-xl font-bold tracking-tight', collapsed && 'md:hidden')}>
            {APP_NAME}
            <span className="text-accent">.</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2.5">
          {items.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                title={item.label}
                className={cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  collapsed && 'md:justify-center md:px-0',
                  isActive
                    ? 'bg-accent-soft text-accent-bright'
                    : 'text-ink-soft hover:bg-panel-soft hover:text-ink',
                )}
                onClick={() => {
                  onSelect(item.id)
                  onCloseMobile()
                }}
              >
                <NavIcon name={item.id} />
                <span className={cx('flex-1 text-left', collapsed && 'md:hidden')}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        <footer
          className={cx(
            'border-t border-line px-4 py-3 text-[11px] leading-tight text-muted',
            collapsed && 'md:hidden',
          )}
        >
          <div>{APP_COPYRIGHT}</div>
          <div className="mt-0.5 opacity-70">{APP_VERSION} · MIT License</div>
        </footer>
      </aside>
    </>
  )
}
