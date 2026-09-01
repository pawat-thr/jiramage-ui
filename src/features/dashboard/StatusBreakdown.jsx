import { CATEGORIES } from './aggregate.js'
import { card, emptyState } from '../../utils/ui.js'

const catColor = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.color]))

// Count per status name — single accent series, category shown by the dot.
export default function StatusBreakdown({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className={card}>
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">Status breakdown</h2>
      </div>
      {!rows.length ? (
        <div className={emptyState}>No statuses to show.</div>
      ) : (
        <div className="grid gap-2.5 p-4">
          {rows.map((r) => (
            <div key={r.name} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 max-sm:grid-cols-[100px_1fr_32px]">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-soft">
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: catColor[r.cat] || catColor.new }}
                />
                <span className="truncate" title={r.name}>
                  {r.name}
                </span>
              </span>
              <span className="block h-2.5 rounded-[4px] bg-field">
                <span
                  className="block h-full rounded-[4px] bg-accent transition-[width] duration-500"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-[13px] font-semibold text-ink tabular-nums">
                {r.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
