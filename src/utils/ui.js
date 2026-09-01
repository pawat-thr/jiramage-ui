// Shared Tailwind class recipes for the handful of shapes reused everywhere.
export const cx = (...classes) => classes.filter(Boolean).join(' ')

export const chip =
  'rounded-full border border-line bg-panel px-3.5 py-[7px] text-[13px] text-ink-soft transition-colors hover:border-line-strong'

export const chipOn = 'border-accent! bg-accent-soft! text-accent-bright!'

export const miniBtn =
  'rounded-lg border border-line bg-field px-2.5 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent-bright'

export const card =
  'overflow-hidden rounded-[18px] border border-line bg-panel shadow-card'

export const emptyState = 'px-4 py-12 text-center text-muted'

export const searchInput =
  'min-w-[180px] max-w-[340px] flex-1 rounded-full border border-line bg-field px-3.5 py-2 text-ink placeholder:text-muted'

export const toolbar = 'mb-3.5 flex flex-wrap items-center gap-2.5'

export const th =
  'border-b border-line px-4 py-3 text-left text-xs font-semibold tracking-[0.06em] text-muted uppercase'

export const td = 'border-b border-line px-4 py-[11px] align-middle'
