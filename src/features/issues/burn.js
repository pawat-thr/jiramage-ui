import { CFG } from '../../config/appConfig.js'

// Working time: Mon–Fri, 09:30–18:30 (a 9h window holding 8 working hours —
// lunch is pro-rated). Burn is expressed in MANDAYS (1 manday = 8 worked hours).

const DAY_START = { h: 9, m: 30 }
const DAY_END = { h: 18, m: 30 }
const WINDOW_HOURS = 9

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
      const winStart = at(cursor, DAY_START)
      const winEnd = at(cursor, DAY_END)
      const from = start > winStart ? start : winStart
      const to = end < winEnd ? end : winEnd
      if (to > from) hours += (to - from) / 3600000
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return hours / WINDOW_HOURS
}

export const isBurnStatus = (name) =>
  CFG.burnStatuses.some((s) => s.toLowerCase() === (name || '').toLowerCase())

// Earliest transition INTO any burn status from an issue's changelog entries.
export function firstBurnStart(changelogValues) {
  let earliest = null
  for (const h of changelogValues || []) {
    for (const item of h.items || []) {
      if (item.field !== 'status' || !isBurnStatus(item.toString)) continue
      if (!earliest || h.created < earliest) earliest = h.created
    }
  }
  return earliest
}
