import { avatarColor, initials } from '../pr/prConstants.js'
import { card, emptyState } from '../../utils/ui.js'

const fmtPts = (n) => (n % 1 ? n.toFixed(1) : String(n))

// Workload heat: calm slate at 0 → full danger-red for the heaviest load.
const heat = (ratio) =>
  `color-mix(in oklab, var(--color-danger) ${Math.round(Math.min(1, ratio) * 100)}%, var(--color-slate))`

// Burn staging: blue on track, amber ≥75% of the estimate, red over.
const burnColor = (ratio) =>
  ratio > 1 ? 'var(--color-danger)' : ratio >= 0.75 ? 'var(--color-amber)' : 'var(--color-blue)'

// One labeled bar line: the tiny LOAD / BURN caption on the left keeps the two
// bars unmistakable even with many members stacked.
function BarLine({ label, ratio, color, right, title }) {
  return (
    <div className="grid grid-cols-[42px_1fr_110px] items-center gap-2" title={title}>
      <span className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
        {label}
      </span>
      <span className="block h-2 rounded-[4px] bg-field">
        <span
          className="block h-full rounded-[4px] transition-[width] duration-500"
          style={{ width: `${Math.min(1, ratio) * 100}%`, background: color }}
        />
      </span>
      <span className="text-right text-[11px] whitespace-nowrap tabular-nums" style={{ color }}>
        {right}
      </span>
    </div>
  )
}

// Per member: active subtask load + (when they have in-progress work) burn.
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
          {total.count} subtask{total.count === 1 ? '' : 's'} · {fmtPts(total.points)} pts total
        </span>
      </div>

      {!rows.length ? (
        <div className={emptyState}>No active subtasks.</div>
      ) : (
        <div className="grid p-4 pt-2">
          {rows.map((r) => {
            const burn = memberBurn[r.key]
            const burnRatio = burn && burn.estimate > 0 ? burn.burned / burn.estimate : 0
            return (
              <div
                key={r.key}
                className="grid gap-1.5 border-b border-line py-3 last:border-b-0 last:pb-1"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink">
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-bg"
                      style={{ background: avatarColor(r.key) }}
                    >
                      {initials(r.name)}
                    </span>
                    <span className="truncate">
                      {r.name}
                      {r.isMe && <span className="font-normal text-muted"> (me)</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {r.count} task{r.count === 1 ? '' : 's'}
                  </span>
                </div>

                <BarLine
                  label="Load"
                  ratio={r.points / maxPoints}
                  color={heat(r.points / maxPoints)}
                  right={`${fmtPts(r.points)} pts`}
                  title="Active workload — open subtask points assigned (redder = heavier vs teammates)"
                />
                {burn && burn.estimate > 0 && (
                  <BarLine
                    label="Burn"
                    ratio={burnRatio}
                    color={burnColor(burnRatio)}
                    right={`${burn.burned.toFixed(1)} / ${fmtPts(burn.estimate)} pt`}
                    title={`Time burned on in-progress cards vs their estimates (1 manday = 8 pt)${burnRatio > 1 ? ' — OVER estimate' : ''}`}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
