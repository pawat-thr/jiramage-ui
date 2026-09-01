import { typeColor } from '../../utils/typeColors.js'
import { card, emptyState } from '../../utils/ui.js'

const TIER_LABELS = { 1: 'Epic tier', 0: 'Standard', '-1': 'Sub-task tier' }

// Count per work type — single accent series; hierarchy shown as a tier tag.
export default function TypeBreakdown({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className={card}>
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">Work type breakdown</h2>
      </div>
      {!rows.length ? (
        <div className={emptyState}>No work types to show.</div>
      ) : (
        <div className="grid gap-2.5 p-4">
          {rows.map((r) => (
            <div
              key={r.name}
              className="grid grid-cols-[130px_1fr_36px] items-center gap-3 max-sm:grid-cols-[100px_1fr_32px]"
              title={`${r.name} · ${TIER_LABELS[r.tier] ?? 'Standard'}`}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-soft">
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: typeColor(r.name).fg }}
                />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="block h-2.5 rounded-[4px] bg-field">
                <span
                  className="block h-full rounded-[4px] transition-[width] duration-500"
                  style={{ width: `${(r.count / max) * 100}%`, background: typeColor(r.name).fg }}
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
