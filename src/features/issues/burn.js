import { CFG } from '../../config/appConfig.js'

// Working time: Mon–Fri, 09:30–12:00 and 13:00–18:30 (2.5h + 5.5h = 8 worked
// hours/day, lunch excluded). Burn is expressed in MANDAYS (1 manday = 8h).
// Hardcoded for this beta — a Settings "work time" option comes later.

const WINDOWS = [
  [{ h: 9, m: 30 }, { h: 12, m: 0 }],
  [{ h: 13, m: 0 }, { h: 18, m: 30 }],
]
const HOURS_PER_DAY = 8

const at = (date, { h, m }) => {
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6

// Mandays of working time between two datetimes (local timezone).
export function workingMandays(startISO, end = new Date()) {
  const start = new Date(startISO)
  if (!(start < end)) return 0
  let hours = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 400 && cursor <= end; i++) {
    if (!isWeekend(cursor)) {
      for (const [ws, we] of WINDOWS) {
        const winStart = at(cursor, ws)
        const winEnd = at(cursor, we)
        const from = start > winStart ? start : winStart
        const to = end < winEnd ? end : winEnd
        if (to > from) hours += (to - from) / 3600000
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return hours / HOURS_PER_DAY
}

export const isBurnStatus = (name) =>
  CFG.burnStatuses.some((s) => s.toLowerCase() === (name || '').toLowerCase())

// Post-dev statuses where the burn stat is shown FROZEN (what was used).
export const isFinishedStatus = (name) =>
  CFG.burnFinishedStatuses.some((s) => s.toLowerCase() === (name || '').toLowerCase())

// All [enter, leave] periods the card spent in a burn status, from the
// changelog. Leaving dev CLOSES an interval; coming back OPENS a new one, so
// burn pauses while the card sits elsewhere and continues on re-entry.
// The last interval is open (end: null) when the card is still in dev.
export function burnIntervals(changelogValues) {
  const statusChanges = []
  for (const h of changelogValues || []) {
    for (const item of h.items || []) {
      if (item.field === 'status') statusChanges.push({ at: h.created, to: item.toString })
    }
  }
  statusChanges.sort((a, b) => (a.at < b.at ? -1 : 1))
  const intervals = []
  let open = null
  for (const c of statusChanges) {
    if (isBurnStatus(c.to)) {
      if (!open) open = c.at
    } else if (open) {
      intervals.push([open, c.at])
      open = null
    }
  }
  if (open) intervals.push([open, null])
  return intervals
}

// Total mandays across all burn intervals (open interval runs until `now`).
export function intervalMandays(intervals, now = new Date()) {
  let total = 0
  for (const [start, end] of intervals || []) {
    total += workingMandays(start, end ? new Date(end) : now)
  }
  return total
}
