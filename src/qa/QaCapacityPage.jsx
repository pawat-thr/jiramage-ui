import { useEffect, useMemo, useState } from 'react'
import ModalShell from '../components/common/ModalShell.jsx'
import Spinner from '../components/common/Spinner.jsx'
import { fetchQaIssues, browseUrl } from '../services/jiraApi.js'
import { loadPlans, savePlan } from '../services/qaPlanApi.js'
import { firebaseEnabled } from '../services/firebase.js'
import {
  monthKey,
  monthDays,
  dateKey,
  isWeekend,
  capacityOf,
  plannedOn,
  autoPlace,
  removeChunk,
  addChunk,
  setChunkPoints,
  setCapacity,
  reflowFrom,
} from './capacity.js'
import { CFG } from '../config/appConfig.js'
import { emailUsername } from '../utils/format.js'
import { avatarColor, initials } from '../features/pr/prConstants.js'
import { card, cx } from '../utils/ui.js'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const input =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:border-accent'

const DAY_MIN = 'min-w-[92px]'
const LEFT_COL = 'sticky left-0 z-10 min-w-[280px] max-w-[280px] border-r border-line bg-panel'

function Avatar({ email, size = 'size-6', text = 'text-[10px]' }) {
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-bold text-bg', size, text)}
      style={{ background: avatarColor(email) }}
      title={emailUsername(email)}
    >
      {initials(emailUsername(email))}
    </span>
  )
}

export default function QaCapacityPage({ onNotify }) {
  const today = dateKey(new Date())
  const [mKey, setMKey] = useState(monthKey(new Date()))
  const days = useMemo(() => monthDays(mKey), [mKey])
  const monthEnd = days[days.length - 1]

  const [tasks, setTasks] = useState(null)
  const [plans, setPlans] = useState(null)
  const [chunkEdit, setChunkEdit] = useState(null)
  const [capEdit, setCapEdit] = useState(null)
  const [drag, setDrag] = useState(null)
  const [memberFilter, setMemberFilter] = useState('')
  const [search, setSearch] = useState('')
  const [hoverTask, setHoverTask] = useState(null)
  const [dockOpen, setDockOpen] = useState(true)
  const [capOpen, setCapOpen] = useState(true)

  useEffect(() => {
    let on = true
    fetchQaIssues()
      .then((issues) => {
        if (!on) return
        const map = {}
        for (const i of issues) {
          const pts = Number(i.fields[CFG.pointField]) || 0
          if (!pts) continue
          map[i.key] = {
            key: i.key,
            summary: i.fields.summary,
            points: pts,
            status: i.fields.status?.name || '',
            statusCategory: i.fields.status?.statusCategory?.key || 'new',
            assignee: i.fields.assignee?.emailAddress || '',
            storyKey: i.fields.parent?.key || null,
            storySummary: i.fields.parent?.fields?.summary || null,
          }
        }
        setTasks(map)
      })
      .catch((err) => on && onNotify(err.message, true))
    return () => {
      on = false
    }
  }, [])

  useEffect(() => {
    let on = true
    setPlans(null)
    const empty = () => Object.fromEntries(CFG.qaEmails.map((e) => [e, { capacity: {}, days: {} }]))
    if (!firebaseEnabled) {
      setPlans(empty())
      return
    }
    loadPlans(CFG.qaEmails, mKey)
      .then((p) => on && setPlans(p))
      .catch((err) => {
        if (!on) return
        onNotify(err.message, true)
        setPlans(empty())
      })
    return () => {
      on = false
    }
  }, [mKey])

  const persist = (email, plan) => {
    setPlans((p) => ({ ...p, [email]: plan }))
    if (firebaseEnabled) savePlan(email, mKey, plan).catch((err) => onNotify(err.message, true))
  }

  // task-centric view: key -> day -> [{email, index, points, delayed}]
  const { taskCells, taskOwners, allocated } = useMemo(() => {
    const cells = {}
    const owners = {}
    const alloc = {}
    for (const [email, plan] of Object.entries(plans || {})) {
      for (const [day, chunks] of Object.entries(plan.days || {})) {
        chunks.forEach((c, index) => {
          ;((cells[c.key] ||= {})[day] ||= []).push({ email, index, points: c.points, delayed: c.delayed })
          ;(owners[c.key] ||= new Set()).add(email)
          alloc[c.key] = (alloc[c.key] || 0) + (Number(c.points) || 0)
        })
      }
    }
    return { taskCells: cells, taskOwners: owners, allocated: alloc }
  }, [plans])

  // planned rows grouped by parent story
  const storyGroups = useMemo(() => {
    if (!tasks) return []
    const q = search.trim().toLowerCase()
    const keys = Object.keys(taskCells).filter((k) => {
      if (memberFilter && ![...(taskOwners[k] || [])].includes(memberFilter)) return false
      if (!q) return true
      const t = tasks[k]
      return k.toLowerCase().includes(q) || (t?.summary || '').toLowerCase().includes(q)
    })
    const byStory = new Map()
    for (const k of keys) {
      const t = tasks[k]
      const sk = t?.storyKey || k
      if (!byStory.has(sk)) {
        byStory.set(sk, { storyKey: sk, storySummary: t?.storySummary || (t?.storyKey ? '' : t?.summary) || '', rows: [] })
      }
      byStory.get(sk).rows.push(k)
    }
    return [...byStory.values()]
      .map((g) => ({ ...g, rows: g.rows.sort() }))
      .sort((a, b) => a.storyKey.localeCompare(b.storyKey, undefined, { numeric: true }))
  }, [tasks, taskCells, taskOwners, memberFilter, search])

  // unplanned dock (bottom, frozen)
  const dock = useMemo(() => {
    if (!tasks) return []
    const q = search.trim().toLowerCase()
    return Object.values(tasks)
      .filter((t) => t.statusCategory !== 'done')
      .map((t) => ({ ...t, left: t.points - (allocated[t.key] || 0) }))
      .filter((t) => t.left > 0)
      .filter((t) => !memberFilter || t.assignee === memberFilter)
      .filter((t) => !q || t.key.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q))
      .sort((a, b) => b.left - a.left)
  }, [tasks, allocated, memberFilter, search])

  // dock grouped per parent STORY (planning is story-first): each group lists
  // its unplanned subtasks with their QA, matching the main table's grouping
  const dockGroups = useMemo(() => {
    const by = new Map()
    for (const t of dock) {
      const sk = t.storyKey || t.key
      if (!by.has(sk)) {
        by.set(sk, { storyKey: sk, storySummary: t.storySummary || (t.storyKey ? '' : t.summary) || '', tasks: [] })
      }
      by.get(sk).tasks.push(t)
    }
    return [...by.values()].sort((a, b) => a.storyKey.localeCompare(b.storyKey, undefined, { numeric: true }))
  }, [dock])

  const allCapEmails = memberFilter ? [memberFilter] : CFG.qaEmails
  // collapsed strip: only QAs that have anything planned this month (still droppable via expand)
  const capEmails = capOpen
    ? allCapEmails
    : allCapEmails.filter((e) => Object.keys(plans?.[e]?.days || {}).length > 0)

  const navMonth = (delta) => {
    const [y, m] = mKey.split('-').map(Number)
    setMKey(monthKey(new Date(y, m - 1 + delta, 1)))
  }
  const startFrom = mKey === today.slice(0, 7) ? today : days[0]

  const planTask = (task, email, fromDay) => {
    if (!CFG.qaEmails.includes(email)) {
      onNotify(`${task.key} has no QA assignee — drop it on a QA's capacity row instead`, true)
      return
    }
    const { plan, unplaced } = autoPlace(plans[email], task.key, task.left ?? task.points, fromDay, {
      untilDay: monthEnd,
    })
    persist(email, plan)
    onNotify(
      unplaced > 0
        ? `Planned ${task.key} for ${emailUsername(email)} — ${unplaced} pt didn't fit this month`
        : `✓ Planned ${task.key} (${task.left ?? task.points} pt) → ${emailUsername(email)}`,
      unplaced > 0,
    )
  }

  // plan a whole story's unplanned subtasks in one go — each for its own QA.
  // Fold autoPlace over a local plan per QA so each task sees the previous
  // one's allocations, persist once per QA.
  const planAll = (groupTasks) => {
    const byEmail = new Map()
    let skipped = 0
    for (const t of groupTasks) {
      if (!CFG.qaEmails.includes(t.assignee)) {
        skipped++
        continue
      }
      if (!byEmail.has(t.assignee)) byEmail.set(t.assignee, [])
      byEmail.get(t.assignee).push(t)
    }
    let spill = 0
    let count = 0
    for (const [email, ts] of byEmail) {
      let plan = plans[email]
      for (const t of ts) {
        const r = autoPlace(plan, t.key, t.left, startFrom, { untilDay: monthEnd })
        plan = r.plan
        spill += r.unplaced
        count++
      }
      persist(email, plan)
    }
    const extras = [
      spill > 0 && `${spill} pt didn't fit this month`,
      skipped > 0 && `${skipped} without a QA skipped — drop those on a capacity row`,
    ].filter(Boolean)
    onNotify(
      `${spill > 0 ? '' : '✓ '}Planned ${count} subtasks for their QAs${extras.length ? ` — ${extras.join(' · ')}` : ''}`,
      spill > 0 || skipped > 0,
    )
  }

  const moveChunkDay = (from, toDay) => {
    if (from.day === toDay) return
    const { plan, chunk } = removeChunk(plans[from.email], from.day, from.index)
    if (!chunk) return
    persist(from.email, addChunk(plan, toDay, chunk))
  }

  const reflow = (email, fromDay) => {
    const { plan, moved, unplaced } = reflowFrom(plans[email], fromDay, { untilDay: monthEnd })
    persist(email, plan)
    onNotify(
      moved.length
        ? `↻ Reflowed ${emailUsername(email)} — delayed: ${moved.join(', ')}${unplaced > 0 ? ` · ${unplaced} pt didn't fit` : ''}`
        : `✓ Reflowed ${emailUsername(email)} — nothing had to move`,
    )
  }

  if (!CFG.qaEmails.length)
    return (
      <div className={card}>
        <div className="px-4 py-12 text-center text-muted">
          No QA team configured — add <code className="text-accent-bright">QA_EMAILS</code> to .env.
        </div>
      </div>
    )
  if (tasks === null || plans === null) return <Spinner label="Loading QA plan…" />

  const [yy, mm] = mKey.split('-').map(Number)

  return (
    <div className="grid gap-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-xl border border-line bg-field">
          <button className="px-3 py-1.5 text-ink-soft hover:text-accent-bright" onClick={() => navMonth(-1)} aria-label="Previous month">‹</button>
          <span className="min-w-[150px] px-2 text-center text-sm font-semibold">{MONTH_NAMES[mm - 1]} {yy}</span>
          <button className="px-3 py-1.5 text-ink-soft hover:text-accent-bright" onClick={() => navMonth(1)} aria-label="Next month">›</button>
        </div>
        <button className="rounded-full border border-line bg-panel px-3.5 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright" onClick={() => setMKey(monthKey(new Date()))}>
          Today
        </button>
        <select
          className="rounded-full border border-line bg-field px-3 py-1.5 text-[13px] text-ink-soft focus:border-accent"
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
        >
          <option value="">All QA ({CFG.qaEmails.length})</option>
          {CFG.qaEmails.map((e) => (
            <option key={e} value={e}>{emailUsername(e)}</option>
          ))}
        </select>
        <input
          type="search"
          className="w-52 rounded-full border border-line bg-field px-3.5 py-1.5 text-[13px] text-ink placeholder:text-muted focus:border-accent"
          placeholder="Search task key or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!firebaseEnabled && (
          <span className="rounded-full border border-amber/40 bg-amber-soft px-3 py-1 text-xs text-amber">
            no Firebase — plan won't be saved
          </span>
        )}
        <span className="flex-1" />
        <span className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-line bg-field" /> planned</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-blue/40 bg-blue-soft" /> in progress</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-success/40 bg-success-soft" /> done</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-amber bg-amber-soft" /> delayed</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-danger" /> overloaded</span>
        </span>
      </div>

      {/* one table: capacity strip + story-grouped task rows */}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={cx(LEFT_COL, 'z-20 border-b px-3 py-1.5 text-left text-[11px] font-semibold tracking-wide text-muted uppercase')}>
                <span className="flex items-center justify-between gap-2">
                  Task / Capacity
                  <button
                    className="rounded-full border border-line bg-field px-2 py-0.5 text-[10px] font-medium normal-case text-ink-soft hover:border-accent hover:text-accent-bright"
                    title={capOpen ? 'Collapse the capacity strip to only QAs with a plan' : 'Show all QA capacity rows'}
                    onClick={() => setCapOpen((v) => !v)}
                  >
                    {capOpen ? `all QA ▴` : `${capEmails.length}/${allCapEmails.length} QA ▾`}
                  </button>
                </span>
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className={cx(
                    DAY_MIN,
                    'border-b border-l border-line px-1 py-2 text-center text-[13px] font-semibold',
                    isWeekend(d) ? 'bg-panel-soft/60 text-muted' : 'text-ink-soft',
                    d === today && 'bg-accent-soft text-accent-bright',
                  )}
                >
                  {Number(d.slice(8))}
                  <span className="block text-[10px] font-normal opacity-70">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(d + 'T12:00:00').getDay()]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* capacity strip */}
            {capEmails.map((email) => {
              const plan = plans[email]
              const totPlanned = days.reduce((a, d) => a + plannedOn(plan, d), 0)
              const totCap = days.reduce((a, d) => a + capacityOf(plan, d), 0)
              return (
                <tr key={email}>
                  <td className={cx(LEFT_COL, 'border-b px-3 py-1.5')}>
                    <div className="flex items-center gap-2">
                      <Avatar email={email} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{emailUsername(email)}</span>
                      <span className="text-[11px] text-muted tabular-nums">{totPlanned}/{totCap}</span>
                      <button
                        className="rounded-full border border-line bg-field px-2 py-0.5 text-[11px] text-ink-soft hover:border-accent hover:text-accent-bright"
                        title="Re-lay this QA's plan from today (moved work marked delayed)"
                        onClick={() => reflow(email, startFrom)}
                      >
                        ↻
                      </button>
                    </div>
                  </td>
                  {days.map((d) => {
                    const cap = capacityOf(plan, d)
                    const planned = plannedOn(plan, d)
                    const over = planned > cap
                    return (
                      <td
                        key={d}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (drag?.type === 'task') planTask(drag.task, email, d)
                          setDrag(null)
                        }}
                        className={cx('border-b border-l border-line p-0.5 text-center', isWeekend(d) && 'bg-panel-soft/60', d === today && 'bg-accent-soft/30')}
                      >
                        <button
                          onClick={() => setCapEdit({ email, day: d })}
                          title={`${emailUsername(email)} · ${d}: ${planned} planned / ${cap} capacity — click to set capacity. Drop an unplanned task here to plan it for this QA from this day.`}
                          className={cx(
                            'w-full rounded px-0.5 py-1 text-[12px] tabular-nums',
                            over ? 'bg-danger font-semibold text-white' : planned > 0 ? 'font-medium text-ink-soft hover:bg-panel-soft' : 'text-muted hover:bg-panel-soft',
                            cap === 0 && !over && 'opacity-40',
                          )}
                        >
                          {planned > 0 ? `${planned}/${cap}` : cap}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {/* story-grouped task rows */}
            {storyGroups.length === 0 && (
              <tr>
                <td className={cx(LEFT_COL, 'px-3 py-4 text-[12px] text-muted')}>Nothing planned yet</td>
                <td colSpan={days.length} className="border-l border-line px-4 py-4 text-[12px] text-muted">
                  Drag a task from the dock below onto a capacity cell (that picks the QA + start day), or press ⚡ on a task.
                </td>
              </tr>
            )}
            {storyGroups.map((g) => (
              <StoryGroup
                key={g.storyKey}
                group={g}
                tasks={tasks}
                taskCells={taskCells}
                taskOwners={taskOwners}
                allocated={allocated}
                days={days}
                today={today}
                drag={drag}
                setDrag={setDrag}
                hoverTask={hoverTask}
                setHoverTask={setHoverTask}
                onChunkClick={setChunkEdit}
                onMoveChunk={moveChunkDay}
                onQuickRemove={(ref) => {
                  const { plan } = removeChunk(plans[ref.email], ref.day, ref.index)
                  persist(ref.email, plan)
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* frozen dock: unplanned tasks pinned to the bottom of the viewport (sticky = aligns with the content column) */}
      <div className="sticky bottom-3 z-30">
        <div className="rounded-2xl border border-line bg-panel/95 shadow-lift backdrop-blur">
          <button className="flex w-full items-center justify-between px-4 py-2 text-left" onClick={() => setDockOpen((v) => !v)}>
            <span className="text-[14px] font-semibold">
              Unplanned <span className="text-muted">({dock.length} tasks · {dock.reduce((a, t) => a + t.left, 0)} pt)</span>
            </span>
            <span className="text-[13px] text-muted">
              drag onto a capacity cell to plan · ⚡ = auto-plan for its QA · {dockOpen ? 'hide ▾' : 'show ▴'}
            </span>
          </button>
          {dockOpen && (
            <div className="max-h-[45vh] overflow-y-auto border-t border-line px-4 py-3">
              {dock.length === 0 && <span className="text-[13px] text-muted">Everything with points is planned. ✓</span>}
              {dockGroups.map((g) => (
                <div key={g.storyKey} className="mb-3 last:mb-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-violet" title={g.storySummary}>
                      {g.storyKey}
                      {g.storySummary ? ` · ${g.storySummary}` : ''}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted tabular-nums">
                      {g.tasks.length} subtask{g.tasks.length === 1 ? '' : 's'} · {g.tasks.reduce((a, t) => a + t.left, 0)} pt
                    </span>
                    {g.tasks.some((t) => CFG.qaEmails.includes(t.assignee)) && (
                      <button
                        className="shrink-0 rounded-full border border-line bg-field px-2.5 py-0.5 text-[11px] text-ink-soft hover:border-accent hover:text-accent-bright"
                        title="Auto-plan every subtask of this story for its own QA, from today"
                        onClick={() => planAll(g.tasks)}
                      >
                        ⚡ Plan all
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-1.5">
                    {g.tasks.map((t) => (
                      <div
                        key={t.key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.key)
                          e.dataTransfer.effectAllowed = 'move'
                          setDrag({ type: 'task', task: t })
                        }}
                        onDragEnd={() => setDrag(null)}
                        onMouseEnter={() => setHoverTask(t.key)}
                        onMouseLeave={() => setHoverTask(null)}
                        className={cx(
                          'flex cursor-grab items-center gap-2 rounded-lg border border-line border-l-[3px] bg-field px-2.5 py-1.5 text-[12px] text-ink-soft hover:border-accent',
                          hoverTask === t.key && 'ring-2 ring-accent',
                        )}
                        style={{ borderLeftColor: avatarColor(t.key) }}
                        title={`${g.storyKey} → ${t.summary}\n${t.left} of ${t.points} pt unplanned · ${t.status} · QA: ${emailUsername(t.assignee || '') || 'none'}`}
                      >
                        <span className="shrink-0 font-semibold text-accent-bright">{t.key}</span>
                        <span className="min-w-0 flex-1 truncate">{t.summary}</span>
                        <span className="shrink-0 font-medium text-ink tabular-nums">{t.left} pt</span>
                        {CFG.qaEmails.includes(t.assignee) ? (
                          <>
                            <Avatar email={t.assignee} size="size-5" text="text-[9px]" />
                            <button
                              className="shrink-0 text-muted hover:text-accent-bright"
                              title={`Auto-plan from today for ${emailUsername(t.assignee)}`}
                              onClick={() => planTask(t, t.assignee, startFrom)}
                            >
                              ⚡
                            </button>
                          </>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted" title="No QA assignee — drop on a capacity row to pick who">
                            no QA
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {chunkEdit && (
        <ChunkModal
          {...chunkEdit}
          plans={plans}
          tasks={tasks}
          onClose={() => setChunkEdit(null)}
          onSave={(points) => {
            persist(chunkEdit.email, setChunkPoints(plans[chunkEdit.email], chunkEdit.day, chunkEdit.index, points))
            setChunkEdit(null)
          }}
          onRemove={() => {
            const { plan } = removeChunk(plans[chunkEdit.email], chunkEdit.day, chunkEdit.index)
            persist(chunkEdit.email, plan)
            setChunkEdit(null)
          }}
          onSaveReflow={(points) => {
            const { email, day, index } = chunkEdit
            const withPoints = setChunkPoints(plans[email], day, index, points)
            const { plan, moved, unplaced } = reflowFrom(withPoints, day, { untilDay: monthEnd, pin: { day, index } })
            persist(email, plan)
            setChunkEdit(null)
            onNotify(
              moved.length
                ? `↻ Saved & reflowed — delayed: ${moved.join(', ')}${unplaced > 0 ? ` · ${unplaced} pt didn't fit` : ''}`
                : '✓ Saved — nothing had to move',
            )
          }}
          onMoveTo={(toEmail) => {
            const { email, day, index } = chunkEdit
            const { plan, chunk } = removeChunk(plans[email], day, index)
            if (!chunk) return
            persist(email, plan)
            persist(toEmail, addChunk(plans[toEmail], day, chunk))
            setChunkEdit(null)
            onNotify(`✓ ${chunk.key} (${chunk.points} pt on ${day}) → ${emailUsername(toEmail)}`)
          }}
        />
      )}

      {capEdit && (
        <CapacityModal
          {...capEdit}
          plan={plans[capEdit.email]}
          onClose={() => setCapEdit(null)}
          onSave={(value) => {
            persist(capEdit.email, setCapacity(plans[capEdit.email], capEdit.day, value))
            setCapEdit(null)
          }}
        />
      )}
    </div>
  )
}

// One story group: header row + one row per task (card on the left, chunks across days).
function StoryGroup({ group, tasks, taskCells, taskOwners, allocated, days, today, drag, setDrag, hoverTask, setHoverTask, onChunkClick, onMoveChunk, onQuickRemove }) {
  return (
    <>
      <tr>
        <td className={cx(LEFT_COL, 'border-b bg-panel-soft px-3 py-1.5')}>
          <span className="block truncate text-[12px] font-semibold text-violet" title={group.storySummary}>
            {group.storyKey}
            {group.storySummary ? ` · ${group.storySummary}` : ''}
          </span>
        </td>
        <td colSpan={days.length} className="border-b border-line bg-panel-soft" />
      </tr>
      {group.rows.map((key) => {
        const t = tasks[key]
        const owners = [...(taskOwners[key] || [])]
        const planned = allocated[key] || 0
        return (
          <tr key={key} className="align-middle hover:bg-panel-soft/40">
            <td
              className={cx(LEFT_COL, 'border-b border-l-[3px] px-3 py-1.5')}
              style={{ borderLeftColor: avatarColor(key) }}
              onMouseEnter={() => setHoverTask(key)}
              onMouseLeave={() => setHoverTask(null)}
            >
              <div className="flex items-center gap-1.5">
                <a className="shrink-0 text-[13px] font-semibold text-accent-bright hover:underline" href={browseUrl(key)} target="_blank" rel="noreferrer">
                  {key}
                </a>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={t?.summary}>
                  {t?.summary || '(gone from Jira)'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={cx('text-[11px] tabular-nums', planned > (t?.points || 0) ? 'text-danger' : 'text-muted')}>
                  {planned}/{t?.points ?? '?'} pt
                </span>
                <span className="text-[11px] text-muted">·</span>
                {owners.map((o) => (
                  <Avatar key={o} email={o} size="size-5" text="text-[9px]" />
                ))}
                {t?.statusCategory === 'done' && <span className="text-[11px] text-success-bright">done ✓</span>}
              </div>
            </td>
            {days.map((d) => {
              const cellChunks = taskCells[key]?.[d] || []
              return (
                <td
                  key={d}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (drag?.type === 'chunk' && drag.key === key) onMoveChunk(drag, d)
                    setDrag(null)
                  }}
                  className={cx(
                    DAY_MIN,
                    'border-b border-l border-line p-0.5',
                    isWeekend(d) && 'bg-panel-soft/60',
                    d === today && 'bg-accent-soft/30',
                  )}
                >
                  {cellChunks.map((c) => (
                    <div key={`${c.email}-${c.index}`} className="group/chunk relative">
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', key)
                          e.dataTransfer.effectAllowed = 'move'
                          setDrag({ type: 'chunk', key, email: c.email, day: d, index: c.index })
                        }}
                        onDragEnd={() => setDrag(null)}
                        onClick={() => onChunkClick({ email: c.email, day: d, index: c.index })}
                        onMouseEnter={() => setHoverTask(key)}
                        onMouseLeave={() => setHoverTask(null)}
                        className={cx(
                          'w-full rounded-md border px-1 py-1.5 text-center text-[13px] font-semibold tabular-nums transition-colors',
                          tasks[key]?.statusCategory === 'done'
                            ? 'border-success/40 bg-success-soft text-success-bright'
                            : c.delayed
                              ? 'border-amber bg-amber-soft text-amber'
                              : tasks[key]?.statusCategory === 'indeterminate'
                                ? 'border-blue/40 bg-blue-soft text-blue'
                                : 'border-line bg-field text-ink-soft',
                          d < today && tasks[key]?.statusCategory !== 'done' && 'opacity-60',
                          hoverTask === key && 'ring-1 ring-accent',
                          'cursor-grab hover:border-accent',
                        )}
                        title={`${key} · ${c.points} pt on ${d} · ${emailUsername(c.email)}${c.delayed ? ' · DELAYED' : ''}\nclick to edit · drag along the row to another day`}
                      >
                        {c.points}
                        {c.delayed ? '⚠' : ''}
                        <span className="block truncate text-[10px] font-normal opacity-70">{emailUsername(c.email)}</span>
                      </button>
                      <button
                        aria-label={`Remove ${key} from ${d}`}
                        title="Remove from plan"
                        className="absolute -top-1.5 -right-1.5 z-10 hidden size-5 place-items-center rounded-full bg-danger text-[11px] leading-none text-white group-hover/chunk:grid"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickRemove({ email: c.email, day: d, index: c.index })
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

function ChunkModal({ email, day, index, plans, tasks, onClose, onSave, onRemove, onSaveReflow, onMoveTo }) {
  const chunk = plans[email]?.days?.[day]?.[index]
  const [points, setPoints] = useState(chunk?.points ?? 0)
  const [moveTo, setMoveTo] = useState('')
  if (!chunk) return null
  const task = tasks[chunk.key]
  return (
    <ModalShell
      title={`${chunk.key} — ${day} · ${emailUsername(email)}`}
      subtitle={task ? `${task.summary} · ${task.status}` : 'Task not found in Jira anymore'}
      onClose={onClose}
      hideFooter
    >
      <div className="grid gap-4">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Points on this day</span>
          <input type="number" min="0" step="0.5" autoFocus className={input} value={points} onChange={(e) => setPoints(e.target.value)} />
          <p className="mt-1.5 text-xs text-muted">
            Took longer? Enter the ACTUAL points and press <strong>Save + Reflow</strong> — the rest
            of {emailUsername(email)}'s plan moves to the next free days (marked delayed).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">Move this chunk to</span>
          <select className="rounded-lg border border-line bg-field px-2 py-1.5 text-[13px] text-ink-soft focus:border-accent" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">— pick QA —</option>
            {CFG.qaEmails.filter((e) => e !== email).map((e) => (
              <option key={e} value={e}>{emailUsername(e)}</option>
            ))}
          </select>
          <button
            disabled={!moveTo}
            className="rounded-full border border-line bg-field px-3 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright disabled:opacity-40"
            onClick={() => onMoveTo(moveTo)}
          >
            Move
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <a className="rounded-full border border-line bg-panel px-3.5 py-2 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright" href={browseUrl(chunk.key)} target="_blank" rel="noreferrer">
              Jira ↗
            </a>
            <button className="rounded-full border border-line bg-panel px-3.5 py-2 text-[13px] text-ink-soft hover:border-danger hover:text-danger" onClick={onRemove}>
              Remove
            </button>
            <button className="rounded-full border border-amber/50 bg-amber-soft px-3.5 py-2 text-[13px] font-medium text-amber hover:border-amber" onClick={() => onSaveReflow(Number(points) || 0)}>
              ↻ Save + Reflow
            </button>
          </div>
          <button className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright hover:bg-accent hover:text-bg" onClick={() => onSave(Number(points) || 0)}>
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function CapacityModal({ email, day, plan, onClose, onSave }) {
  const current = plan.capacity?.[day]
  const [value, setValue] = useState(current ?? '')
  return (
    <ModalShell
      title={`Capacity — ${emailUsername(email)} · ${day}`}
      subtitle="Set this day's working capacity (leave = 0, half day = 4, normal = 8)."
      onClose={onClose}
      hideFooter
    >
      <div className="grid gap-4">
        <input type="number" min="0" step="0.5" autoFocus className={input} placeholder={isWeekend(day) ? 'default 0 (weekend)' : 'default 8'} value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {[0, 4, 8].map((v) => (
              <button key={v} className="rounded-full border border-line bg-field px-3 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright" onClick={() => onSave(v)}>
                {v === 0 ? 'Leave (0)' : v === 4 ? 'Half (4)' : 'Full (8)'}
              </button>
            ))}
            <button className="rounded-full border border-line bg-field px-3 py-1.5 text-[13px] text-muted hover:text-ink" onClick={() => onSave('')}>
              Reset
            </button>
          </div>
          <button className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright hover:bg-accent hover:text-bg" onClick={() => onSave(value)}>
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
