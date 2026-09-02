import { avatarColor, initials } from '../pr/prConstants.js'
import { card, emptyState } from '../../utils/ui.js'

const fmtPts = (n) => (n % 1 ? n.toFixed(1) : String(n))

// Workload heat: calm slate at 0 → full danger-red for the heaviest load.
const heat = (ratio) =>
  `color-mix(in oklab, var(--color-danger) ${Math.round(Math.min(1, ratio) * 100)}%, var(--color-slate))`

// Per member: active subtasks + summed story points.
export default function SubtaskPoints({ rows }) {
  const maxPoints = Math.max(1, ...rows.map((r) => r.points))
  const total = rows.reduce((a, r) => ({ count: a.count + r.count, points: a.points + r.points }), {
    count: 0,
    points: 0,
  })

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">Active subtasks · points</h2>
        <span className="text-xs text-muted">
          {total.count} subtask{total.count === 1 ? '' : 's'} · {fmtPts(total.points)} pts total ·{' '}
          <span className="text-danger">redder = heavier load</span>
        </span>
      </div>

      {!rows.length ? (
        <div className={emptyState}>No active subtasks.</div>
      ) : (
        <div className="grid gap-2.5 p-4">
          {rows.map((r) => (
            <div
              key={r.key}
              className="grid grid-cols-[140px_1fr_auto] items-center gap-3 max-sm:grid-cols-[110px_1fr_auto]"
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-soft">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-bg"
                  style={{ background: avatarColor(r.key) }}
                >
                  {initials(r.name)}
                </span>
                <span className="truncate">
                  {r.name}
                  {r.isMe && <span className="text-muted"> (me)</span>}
                </span>
              </span>
              <span className="block h-2.5 rounded-[4px] bg-field">
                <span
                  className="block h-full rounded-[4px] transition-[width] duration-500"
                  style={{
                    width: `${(r.points / maxPoints) * 100}%`,
                    background: heat(r.points / maxPoints),
                  }}
                />
              </span>
              <span className="flex items-baseline gap-2 text-right">
                <span className="text-xs text-muted tabular-nums">{r.count} task{r.count === 1 ? '' : 's'}</span>
                <span
                  className="w-12 text-sm font-semibold tabular-nums"
                  style={{ color: heat(r.points / maxPoints) }}
                >
                  {fmtPts(r.points)} pts
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
