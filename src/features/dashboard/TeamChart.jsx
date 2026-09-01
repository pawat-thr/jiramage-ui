import { CATEGORIES } from './aggregate.js'
import { card, emptyState } from '../../utils/ui.js'

// Stacked horizontal bars: tasks per member split by status category.
// 2px surface gaps between segments; identity via row label, legend on top.
export default function TeamChart({ rows, onPickMember }) {
  const maxTotal = Math.max(1, ...rows.map((r) => r.total))

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">Tasks per member</h2>
        <div className="flex items-center gap-4">
          {CATEGORIES.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span
                className="inline-block size-2.5 rounded-[3px]"
                style={{ background: c.color }}
              />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <div className={emptyState}>No team issues to chart.</div>
      ) : (
        <div className="grid gap-2 p-4">
          {rows.map((row) => (
            <button
              key={row.key}
              className="grid grid-cols-[120px_1fr_44px] items-center gap-3 rounded-[10px] p-1.5 text-left hover:bg-panel-soft max-sm:grid-cols-[90px_1fr_36px]"
              title={CATEGORIES.map((c) => `${c.label}: ${row.counts[c.key]}`).join(' · ')}
              onClick={() => row.filterName && onPickMember(row.filterName)}
            >
              <span className="truncate text-[13px] text-ink-soft">
                {row.name}
                {row.isMe && <span className="text-muted"> (me)</span>}
              </span>
              <span className="block h-3.5 w-full rounded-[4px] bg-field">
                <span
                  className="flex h-full gap-[2px] overflow-hidden rounded-[4px] transition-[width] duration-500"
                  style={{ width: `${(row.total / maxTotal) * 100}%` }}
                >
                  {CATEGORIES.filter((c) => row.counts[c.key] > 0).map((c) => (
                    <span
                      key={c.key}
                      className="h-full"
                      style={{
                        background: c.color,
                        width: `${(row.counts[c.key] / (row.total || 1)) * 100}%`,
                      }}
                    />
                  ))}
                </span>
              </span>
              <span className="text-right text-[13px] font-semibold text-ink tabular-nums">
                {row.total}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
