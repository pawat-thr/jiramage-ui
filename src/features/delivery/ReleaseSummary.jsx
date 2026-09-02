import { ROLES, fmtPts } from './deliveryUtils.js'
import { card } from '../../utils/ui.js'

function StackedBar({ done, inprog, todo, total, h = 'h-2.5' }) {
  if (!total) return <div className={`${h} rounded-full bg-field`} />
  const w = (v) => `${(v / total) * 100}%`
  return (
    <div className={`flex ${h} gap-[2px] overflow-hidden rounded-full bg-field`}>
      {done > 0 && <span style={{ width: w(done), background: 'var(--color-success)' }} />}
      {inprog > 0 && <span style={{ width: w(inprog), background: 'var(--color-blue)' }} />}
      {todo > 0 && <span style={{ width: w(todo), background: 'var(--color-slate)' }} />}
    </div>
  )
}

// The PM view: overall release progress + per-role rollups, at a glance.
export default function ReleaseSummary({ release, rollup }) {
  const pct = rollup.totalPts ? Math.round((rollup.donePts / rollup.totalPts) * 100) : 0

  return (
    <div className={`${card} p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            Release <span className="text-violet">{release}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {rollup.storyCount} stories ·{' '}
            <span className="text-success-bright">{rollup.storyDone} done</span> ·{' '}
            <span className="text-blue">{rollup.storyInprog} in progress</span> ·{' '}
            <span className="text-slate">{rollup.storyTodo} to do</span>
            {rollup.untagged > 0 && (
              <span className="text-amber"> · ⚠ {rollup.untagged} without FE/BE/QA subtasks</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tracking-tight tabular-nums">{pct}%</span>
          <span className="block text-xs text-muted">
            {fmtPts(rollup.donePts)} / {fmtPts(rollup.totalPts)} pts done
          </span>
        </div>
      </div>

      <div className="mt-3">
        <StackedBar
          done={rollup.donePts}
          inprog={rollup.inprogPts}
          todo={rollup.todoPts}
          total={rollup.totalPts}
        />
        <div className="mt-1.5 flex gap-4 text-xs text-muted">
          <span><span className="mr-1 inline-block size-2 rounded-full bg-success align-middle" />Done</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-blue align-middle" />In progress</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-slate align-middle" />To do</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
        {ROLES.map(({ id, color }) => {
          const r = rollup.roles[id]
          const rp = r.total ? Math.round((r.done / r.total) * 100) : 0
          return (
            <div key={id}>
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
                  <span className="size-2.5 rounded-full" style={{ background: color }} />
                  {id}
                </span>
                <span className="text-sm font-semibold tabular-nums">{rp}%</span>
              </div>
              <div className="mt-1.5">
                <StackedBar done={r.done} inprog={r.inprog} todo={r.todo} total={r.total} h="h-2" />
              </div>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {fmtPts(r.done)} / {fmtPts(r.total)} pts · {r.doneCount}/{r.count} subtasks done
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
