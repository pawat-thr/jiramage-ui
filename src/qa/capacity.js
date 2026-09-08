// QA Capacity Planner — pure planning engine.
// 1 point = 1 hour. Default capacity: 8 points per working day (Mon–Fri).
// A user-month plan: { capacity: { 'YYYY-MM-DD': n }, days: { 'YYYY-MM-DD': [ {key, points, delayed?} ] } }

export const DEFAULT_CAPACITY = 8

export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const monthKey = (d) => dateKey(d).slice(0, 7)

export const isWeekend = (key) => {
  const d = new Date(key + 'T12:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

// All date keys of a month ('YYYY-MM').
export function monthDays(mKey) {
  const [y, m] = mKey.split('-').map(Number)
  const out = []
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
    out.push(dateKey(d))
  }
  return out
}

// Capacity of one day: explicit override wins; weekends default to 0.
export function capacityOf(plan, day) {
  const o = plan?.capacity?.[day]
  if (o != null) return o
  return isWeekend(day) ? 0 : DEFAULT_CAPACITY
}

export const plannedOn = (plan, day) =>
  (plan?.days?.[day] || []).reduce((a, c) => a + (Number(c.points) || 0), 0)

const clone = (plan) => ({
  capacity: { ...(plan?.capacity || {}) },
  days: Object.fromEntries(Object.entries(plan?.days || {}).map(([d, cs]) => [d, cs.map((c) => ({ ...c }))])),
})

// Next working days from `fromDay` (inclusive), unbounded across months.
function* workingDaysFrom(fromDay) {
  const d = new Date(fromDay + 'T12:00:00')
  for (let i = 0; i < 3660; i++) {
    const key = dateKey(d)
    yield key
    d.setDate(d.getDate() + 1)
  }
}

// Auto-place `points` of a task starting at `fromDay`, filling remaining
// capacity day by day. Returns { plan, placed: [{day, points}] }.
export function autoPlace(plan, taskKey, points, fromDay, { delayed = false, untilDay = null } = {}) {
  const next = clone(plan)
  const placed = []
  let left = points
  for (const day of workingDaysFrom(fromDay)) {
    if (left <= 0) break
    if (untilDay && day > untilDay) break // v1: plans stay inside the visible month
    const free = capacityOf(next, day) - plannedOn(next, day)
    if (free <= 0) continue
    const take = Math.min(free, left)
    ;(next.days[day] ||= []).push({ key: taskKey, points: take, ...(delayed ? { delayed: true } : {}) })
    placed.push({ day, points: take })
    left -= take
  }
  return { plan: next, placed, unplaced: left }
}

// Move one chunk (day+index) to another day (possibly on another plan/user).
// Returns the chunk so the caller can insert it into the target plan.
export function removeChunk(plan, day, index) {
  const next = clone(plan)
  const chunks = next.days[day] || []
  const [chunk] = chunks.splice(index, 1)
  if (!chunks.length) delete next.days[day]
  return { plan: next, chunk }
}

export function addChunk(plan, day, chunk) {
  const next = clone(plan)
  ;(next.days[day] ||= []).push({ ...chunk })
  return next
}

export function setChunkPoints(plan, day, index, points) {
  const next = clone(plan)
  const c = next.days[day]?.[index]
  if (c) c.points = points
  return next
}

export function setCapacity(plan, day, capacity) {
  const next = clone(plan)
  if (capacity == null || capacity === '') delete next.capacity[day]
  else next.capacity[day] = Number(capacity)
  return next
}

// REFLOW — the delay handler. Everything ON or AFTER `fromDay` is re-laid
// chronologically (task order preserved) into the available capacity, chunk
// fragments merging as they refill. Chunks that end up on a LATER day than
// before are marked `delayed`, so the UI can show what moved.
export function reflowFrom(plan, fromDay, { untilDay = null, pin = null } = {}) {
  const next = clone(plan)
  // collect chunks to re-lay, in day order then position order. A `pin`
  // ({day, index}) stays where it is — e.g. "this day ACTUALLY took 12pt":
  // the actual stays put (even over capacity) and everything else moves.
  const queue = []
  const days = Object.keys(next.days).sort()
  for (const day of days) {
    if (day < fromDay) continue
    const keep = []
    next.days[day].forEach((c, i) => {
      if (pin && pin.day === day && pin.index === i) keep.push(c)
      else queue.push({ ...c, origDay: day })
    })
    if (keep.length) next.days[day] = keep
    else delete next.days[day]
  }
  // merge consecutive fragments of the same task (keeps totals, tidier cells)
  const merged = []
  for (const c of queue) {
    const last = merged[merged.length - 1]
    if (last && last.key === c.key) {
      last.points += c.points
      if (c.origDay < last.origDay) last.origDay = c.origDay
    } else {
      merged.push({ ...c })
    }
  }
  const moved = []
  let cursorStart = fromDay
  for (const item of merged) {
    let left = item.points
    for (const day of workingDaysFrom(cursorStart)) {
      if (left <= 0) break
      if (untilDay && day > untilDay) break
      const free = capacityOf(next, day) - plannedOn(next, day)
      if (free <= 0) continue
      const take = Math.min(free, left)
      const delayed = day > item.origDay
      ;(next.days[day] ||= []).push({ key: item.key, points: take, ...(delayed ? { delayed: true } : {}) })
      if (delayed && !moved.includes(item.key)) moved.push(item.key)
      left -= take
    }
  }
  // anything that didn't fit inside the window returns to "unplanned"
  const placedTotal = Object.entries(next.days)
    .filter(([d]) => d >= fromDay)
    .reduce((a, [, cs]) => a + cs.reduce((x, c) => x + c.points, 0), 0)
  const queuedTotal = merged.reduce((a, c) => a + c.points, 0)
  return { plan: next, moved, unplaced: queuedTotal - placedTotal }
}
