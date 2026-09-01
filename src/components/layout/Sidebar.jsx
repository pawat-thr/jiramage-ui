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
