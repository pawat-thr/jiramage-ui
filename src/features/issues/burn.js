import { CFG } from '../../config/appConfig.js'
import { DEFAULT_WORK_TIME, DEFAULT_WORK_DAYS, parseWorkTime, parseWorkDays } from '../../config/configFields.js'
import { workDaySet } from '../../utils/workDays.js'

// Working time comes from WORK_TIME (.env or Firebase team config; default
// Mon–Fri 09:30–12:00 + 13:00–18:30 = 8 worked hours/day, lunch excluded).
// Burn is expressed in MANDAYS — 1 manday = one full set of windows — and
// 1 manday renders as 8 points regardless of the window hours (team scale).
// Parsed lazily + cached per raw string, so a team-config overlay (which
// mutates CFG after module load) is always picked up.
let cacheKey = null
let cached = null
export function workWindows(raw = CFG.workTime) {
  const str = String(raw || '').trim() || DEFAULT_WORK_TIME
  if (cacheKey !== str) {
    const windows = parseWorkTime(str) || parseWorkTime(DEFAULT_WORK_TIME)
    const hoursPerDay = windows.reduce((a, [ws, we]) => a + (we.h * 60 + we.m - ws.h * 60 - ws.m) / 60, 0)
    cacheKey = str
    cached = { windows, hoursPerDay }
  }
  return cached
}

const at = (date, { h, m }) => {
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}


// Mandays of working time between two datetimes (local timezone).
export function workingMandays(startISO, end = new Date()) {
  const start = new Date(startISO)
  if (!(start < end)) return 0
  const { windows, hoursPerDay } = workWindows()
  let hours = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 400 && cursor <= end; i++) {
    if (workDaySet().has(cursor.getDay())) {
      for (const [ws, we] of windows) {
        const winStart = at(cursor, ws)
        const winEnd = at(cursor, we)
        const from = start > winStart ? start : winStart
        const to = end < winEnd ? end : winEnd
        if (to > from) hours += (to - from) / 3600000
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return hours / hoursPerDay
}

export const isBurnStatus = (name, statuses = CFG.burnStatuses) =>
  statuses.some((s) => s.toLowerCase() === (name || '').toLowerCase())

// Post-dev statuses where the burn stat is shown FROZEN (what was used).
export const isFinishedStatus = (name, statuses = CFG.burnFinishedStatuses) =>
  statuses.some((s) => s.toLowerCase() === (name || '').toLowerCase())

// All [enter, leave] periods the card spent in a burn status, from the
// changelog. Leaving dev CLOSES an interval; coming back OPENS a new one, so
// burn pauses while the card sits elsewhere and continues on re-entry.
// The last interval is open (end: null) when the card is still in dev.
export function burnIntervals(changelogValues, statuses = CFG.burnStatuses) {
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
    if (isBurnStatus(c.to, statuses)) {
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

// Human label of the EFFECTIVE schedule (what the math actually uses —
// invalid configured values fall back to the defaults, and so does this).
export function workScheduleLabel() {
  const days = parseWorkDays(CFG.workDays) ? String(CFG.workDays).trim() : DEFAULT_WORK_DAYS
  const time = parseWorkTime(CFG.workTime) ? String(CFG.workTime).trim() : DEFAULT_WORK_TIME
  return `${days} ${time}`
}
