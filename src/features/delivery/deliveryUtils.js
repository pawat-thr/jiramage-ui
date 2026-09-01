import { CFG } from '../../config/appConfig.js'

// Roles come from the subtask summary prefix: [FE] / [BE] / [QA].
export const ROLES = [
  { id: 'FE', color: 'var(--color-blue)' },
  { id: 'BE', color: 'var(--color-violet)' },
  { id: 'QA', color: 'var(--color-amber)' },
]

export function roleOf(subtask) {
  const m = /\[(FE|BE|QA)\]/i.exec(subtask.fields?.summary || '')
  return m ? m[1].toUpperCase() : null
}

const emptyRole = () => ({ total: 0, todo: 0, inprog: 0, done: 0, count: 0, doneCount: 0 })

// The QA test-case DESIGN subtask, named exactly "[QA] Test case".
export const isTestCase = (st) => /^\s*\[QA\]\s*test\s*case\s*$/i.test(st.fields?.summary || '')

const emptyTc = () => ({ count: 0, doneCount: 0, inprogCount: 0, pts: 0, donePts: 0 })

// Per-story delivery stats from its subtasks, split by role.
export function deliveryStats(subtasks) {
  const roles = { FE: emptyRole(), BE: emptyRole(), QA: emptyRole() }
  const tc = emptyTc()
  for (const st of subtasks || []) {
    const role = roleOf(st)
    if (!role) continue
    const r = roles[role]
    const pts = Number(st.fields?.[CFG.pointField]) || 0
    const cat = st.fields?.status?.statusCategory?.key || 'new'
    r.total += pts
    r.count++
    if (cat === 'done') {
      r.done += pts
      r.doneCount++
    } else if (cat === 'indeterminate') {
      r.inprog += pts
    } else {
      r.todo += pts
    }
    if (isTestCase(st)) {
      tc.count++
      tc.pts += pts
      if (cat === 'done') {
        tc.doneCount++
        tc.donePts += pts
      } else if (cat === 'indeterminate') {
        tc.inprogCount++
      }
    }
  }
  const deliveryPoints = roles.FE.total + roles.BE.total + roles.QA.total
  const taggedCount = roles.FE.count + roles.BE.count + roles.QA.count
  return { roles, deliveryPoints, taggedCount, tc }
}

export const fmtPts = (n) => (n % 1 ? n.toFixed(1) : String(n))

// Whole-release rollup: per-role and overall points + story status counts.
export function releaseRollup(stories, subMap) {
  const roles = { FE: emptyRole(), BE: emptyRole(), QA: emptyRole() }
  const tc = emptyTc()
  let untagged = 0
  let storyDone = 0
  let storyInprog = 0
  let storyTodo = 0

  for (const s of stories) {
    const stats = deliveryStats(subMap?.[s.key])
    for (const id of ['FE', 'BE', 'QA']) {
      const src = stats.roles[id]
      const dst = roles[id]
      dst.total += src.total
      dst.todo += src.todo
      dst.inprog += src.inprog
      dst.done += src.done
      dst.count += src.count
      dst.doneCount += src.doneCount
    }
    if (stats.taggedCount === 0) untagged++
    tc.count += stats.tc.count
    tc.doneCount += stats.tc.doneCount
    tc.inprogCount += stats.tc.inprogCount
    tc.pts += stats.tc.pts
    tc.donePts += stats.tc.donePts
    const cat = s.fields.status.statusCategory?.key || 'new'
    if (cat === 'done') storyDone++
    else if (cat === 'indeterminate') storyInprog++
    else storyTodo++
  }

  const sum = (k) => roles.FE[k] + roles.BE[k] + roles.QA[k]
  return {
    roles,
    tc,
    totalPts: sum('total'),
    donePts: sum('done'),
    inprogPts: sum('inprog'),
    todoPts: sum('todo'),
    storyCount: stories.length,
    storyDone,
    storyInprog,
    storyTodo,
    untagged,
  }
}

// 0..1 completion for sorting: unfinished/unestimated first, done last.
export function storyProgress(story, stats) {
  if (stats.deliveryPoints > 0) return stats.roles.FE.done + stats.roles.BE.done + stats.roles.QA.done > 0
    ? (stats.roles.FE.done + stats.roles.BE.done + stats.roles.QA.done) / stats.deliveryPoints
    : 0
  return (story.fields.status.statusCategory?.key || 'new') === 'done' ? 1 : 0
}
