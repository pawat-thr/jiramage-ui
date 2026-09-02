import { QA_CATEGORIES, fmtPts } from './deliveryUtils.js'
import { card } from '../../utils/ui.js'

function Bar({ b }) {
  if (!b.count) return <div className="h-2 rounded-full bg-field" />
  const todo = b.count - b.doneCount - b.inprogCount
  const w = (v) => `${(v / b.count) * 100}%`
  return (
    <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-field">
      {b.doneCount > 0 && <span style={{ width: w(b.doneCount), background: 'var(--color-success)' }} />}
      {b.inprogCount > 0 && <span style={{ width: w(b.inprogCount), background: 'var(--color-blue)' }} />}
      {todo > 0 && <span style={{ width: w(todo), background: 'var(--color-slate)' }} />}
    </div>
  )
}

// QA view summary: overall QA + the 9 QA subtask categories.
export default function QASummary({ release, rollup }) {
  const t = rollup.total
  const pct = t.pts ? Math.round((t.donePts / t.pts) * 100) : 0

  return (
    <div className={`${card} p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            QA · Release <span className="text-violet">{release}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            QA Total: {t.doneCount}/{t.count} subtasks done · {fmtPts(t.donePts)} /{' '}
            {fmtPts(t.pts)} pts
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tracking-tight tabular-nums">{pct}%</span>
          <span className="block text-xs text-muted">of QA points done</span>
        </div>
      </div>
      <div className="mt-3">
        <Bar b={t} />
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {QA_CATEGORIES.map((c) => {
          const b = rollup.cats[c.id]
          const cp = b.count ? Math.round((b.doneCount / b.count) * 100) : 0
          return (
            <div key={c.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-ink-soft" title={c.label}>
                  {c.label}
                </span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {b.count ? `${cp}%` : '—'}
                </span>
              </div>
              <div className="mt-1">
                <Bar b={b} />
              </div>
              <p className="mt-0.5 text-xs text-muted tabular-nums">
                {b.count
                  ? `${b.doneCount}/${b.count} done · ${fmtPts(b.donePts)}/${fmtPts(b.pts)} pts`
                  : 'no subtasks'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
