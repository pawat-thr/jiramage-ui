import { avatarColor, initials } from '../pr/prConstants.js'
import { card, emptyState } from '../../utils/ui.js'

const fmtPts = (n) => (n % 1 ? n.toFixed(1) : String(n))

// Workload heat: calm slate at 0 → full danger-red for the heaviest load.
const heat = (ratio) =>
  `color-mix(in oklab, var(--color-danger) ${Math.round(Math.min(1, ratio) * 100)}%, var(--color-slate))`

// Per member burn: sum burned points vs estimated points of their in-dev cards.
const burnColor = (ratio) =>
  ratio > 1 ? 'var(--color-danger)' : ratio >= 0.75 ? 'var(--color-amber)' : 'var(--color-blue)'

// Per member: active subtasks + summed story points (+ dev burn when present).
export default function SubtaskPoints({ rows, memberBurn = {} }) {
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
          <span className="text-danger">redder = heavier load</span> ·{' '}
          <span className="text-blue">thin bar = dev burn vs estimate</span>
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
              {memberBurn[r.key] && memberBurn[r.key].estimate > 0 && (
                <>
                  <span aria-hidden />
                  <span
                    className="block h-1.5 rounded-[4px] bg-field"
                    title={`Dev burn: ${memberBurn[r.key].burned.toFixed(1)} of ${fmtPts(memberBurn[r.key].estimate)} estimated pts on in-dev cards (1 manday = 8 pt)`}
                  >
                    <span
                      className="block h-full rounded-[4px] transition-[width] duration-500"
                      style={{
                        width: `${Math.min(memberBurn[r.key].burned / memberBurn[r.key].estimate, 1) * 100}%`,
                        background: burnColor(memberBurn[r.key].burned / memberBurn[r.key].estimate),
                      }}
                    />
                  </span>
                  <span
                    className="text-right text-[11px] whitespace-nowrap tabular-nums"
                    style={{ color: burnColor(memberBurn[r.key].burned / memberBurn[r.key].estimate) }}
                  >
                    burn {memberBurn[r.key].burned.toFixed(1)} / {fmtPts(memberBurn[r.key].estimate)}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
