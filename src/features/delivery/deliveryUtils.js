import { CFG } from '../../config/appConfig.js'

// Roles come from the subtask summary prefix: [FE] / [BE] / [QA].
export const ROLES = [
  { id: 'FE', color: 'var(--color-blue)' },
  { id: 'BE', color: 'var(--color-violet)' },
  { id: 'QA', color: 'var(--color-amber)' },
]

function roleOf(subtask) {
  const m = /\[(FE|BE|QA)\]/i.exec(subtask.fields?.summary || '')
  return m ? m[1].toUpperCase() : null
}

const emptyRole = () => ({ total: 0, todo: 0, inprog: 0, done: 0, count: 0, doneCount: 0 })

// Per-story delivery stats from its subtasks, split by role.
export function deliveryStats(subtasks) {
  const roles = { FE: emptyRole(), BE: emptyRole(), QA: emptyRole() }
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
  }
  const deliveryPoints = roles.FE.total + roles.BE.total + roles.QA.total
  const taggedCount = roles.FE.count + roles.BE.count + roles.QA.count
  return { roles, deliveryPoints, taggedCount }
}

export const fmtPts = (n) => (n % 1 ? n.toFixed(1) : String(n))

// The QA subtask taxonomy (matched against the [QA] subtask summary).
export const QA_CATEGORIES = [
  { id: 'test_case', label: 'Test Case', re: /^\s*\[QA\]\s*test\s*case\s*$/i },
  { id: 'test_review', label: 'Test Review', re: /review\s*test\s*case/i },
  { id: 'data_sit', label: 'Test Data on SIT', re: /test\s*data\s*on\s*sit/i },
  { id: 'exec_sit', label: 'Test Execute SIT', re: /test\s*execute\s*(on\s*)?sit/i },
  { id: 'data_uat', label: 'Test Data on UAT & Regression', re: /test\s*data\s*on\s*uat/i },
  { id: 'support_uat', label: 'Support UAT', re: /support\s*uat/i },
  { id: 'support_reg', label: 'Support Regression', re: /support\s*regression/i },
  { id: 'support_pvt', label: 'Support PVT', re: /support\s*pvt/i },
  { id: 'review_task', label: 'Review Task', re: /review\s*task/i },
]

const emptyBucket = () => ({ count: 0, doneCount: 0, inprogCount: 0, pts: 0, donePts: 0 })

const addToBucket = (b, pts, cat) => {
  b.count++
  b.pts += pts
  if (cat === 'done') {
    b.doneCount++
    b.donePts += pts
  } else if (cat === 'indeterminate') {
    b.inprogCount++
  }
}

// Per-story QA stats: overall total + one bucket per QA category.
export function qaStats(subtasks) {
  const total = emptyBucket()
  const cats = Object.fromEntries(QA_CATEGORIES.map((c) => [c.id, emptyBucket()]))
  for (const st of subtasks || []) {
    if (roleOf(st) !== 'QA') continue
    const pts = Number(st.fields?.[CFG.pointField]) || 0
    const cat = st.fields?.status?.statusCategory?.key || 'new'
    addToBucket(total, pts, cat)
    const match = QA_CATEGORIES.find((c) => c.re.test(st.fields?.summary || ''))
    if (match) addToBucket(cats[match.id], pts, cat)
  }
  return { total, cats }
}

// Release-wide QA rollup across all stories.
export function qaRollup(stories, subMap) {
  const merge = (dst, src) => {
    dst.count += src.count
    dst.doneCount += src.doneCount
    dst.inprogCount += src.inprogCount
    dst.pts += src.pts
    dst.donePts += src.donePts
  }
  const agg = {
    total: emptyBucket(),
    cats: Object.fromEntries(QA_CATEGORIES.map((c) => [c.id, emptyBucket()])),
  }
  for (const s of stories) {
    const st = qaStats(subMap?.[s.key])
    merge(agg.total, st.total)
    for (const c of QA_CATEGORIES) merge(agg.cats[c.id], st.cats[c.id])
  }
  return agg
}

// Whole-release rollup: per-role and overall points + story status counts.
export function releaseRollup(stories, subMap) {
  const roles = { FE: emptyRole(), BE: emptyRole(), QA: emptyRole() }
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
    const cat = s.fields.status.statusCategory?.key || 'new'
    if (cat === 'done') storyDone++
    else if (cat === 'indeterminate') storyInprog++
    else storyTodo++
  }

  const sum = (k) => roles.FE[k] + roles.BE[k] + roles.QA[k]
  return {
    roles,
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
