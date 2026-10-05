import { CFG } from '../config/appConfig.js'
import { DEFAULT_WORK_DAYS, parseWorkDays } from '../config/configFields.js'

// Which weekdays count as working days (burn + capacity planning). Reads
// WORK_DAYS from CFG at call time (so the Firebase team-config overlay
// applies), parsed lazily + cached per raw string; invalid values fall back
// to the Mon–Fri default rather than breaking anything.
let cacheKey = null
let cached = null
export function workDaySet(raw = CFG.workDays) {
  const str = String(raw || '').trim() || DEFAULT_WORK_DAYS
  if (cacheKey !== str) {
    cached = new Set(parseWorkDays(str) || parseWorkDays(DEFAULT_WORK_DAYS))
    cacheKey = str
  }
  return cached
}
