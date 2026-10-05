// ONE definition of the movable team-config fields — shared by
// vite.config.js (build-time .env parsing) and src/services/configApi.js
// (runtime Firebase overlay + Settings editor), so the two sides can't
// diverge. Pure JS on purpose: this file must be importable from node.

// "5m" / "30s" / "1h" → ms, or null when the string doesn't parse.
// (Callers pick their own fallback: vite defaults to 5 minutes, the runtime
// overlay skips invalid values so the previous value stands.)
export const parseInterval = (raw) => {
  const m = /^(\d+)([smh])$/.exec(String(raw || '').trim())
  return m ? Number(m[1]) * { s: 1000, m: 60000, h: 3600000 }[m[2]] : null
}

export const list = (raw, upper = false) =>
  String(raw || '')
    .split(',')
    .map((s) => (upper ? s.trim().toUpperCase() : s.trim()))
    .filter(Boolean)

// Working time for burn tracking: comma-separated HH:MM-HH:MM windows
// (Mon-Fri implied; lunch is simply not a window). Parsed leniently — an
// invalid value falls back to this default rather than breaking burn math.
export const DEFAULT_WORK_TIME = '09:30-12:00,13:00-18:30'

// '09:30-12:00,13:00-18:30' -> [[{h,m},{h,m}], ...] or null when malformed.
export function parseWorkTime(str) {
  const wins = []
  for (const part of String(str || '').split(',')) {
    const m = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(part)
    if (!m) return null
    const s = { h: +m[1], m: +m[2] }
    const e = { h: +m[3], m: +m[4] }
    if (s.h > 23 || e.h > 23 || s.m > 59 || e.m > 59) return null
    if (e.h * 60 + e.m <= s.h * 60 + s.m) return null
    wins.push([s, e])
  }
  return wins.length ? wins : null
}

// Working days for burn + capacity planning. Day names, 3-letter or full,
// case-insensitive. Everything NOT listed is a day off (0 capacity, no burn).
export const DEFAULT_WORK_DAYS = 'Mon,Tue,Wed,Thu,Fri'

const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

// 'Mon,Tue,Fri' -> [1, 2, 5] (sorted, unique) or null when malformed.
export function parseWorkDays(str) {
  const out = new Set()
  for (const part of String(str || '').split(',')) {
    const t = part.trim().slice(0, 3).toLowerCase()
    if (!t) continue
    if (!(t in DAY_INDEX)) return null
    out.add(DAY_INDEX[t])
  }
  return out.size ? [...out].sort() : null
}

// `required`: rule 4 of the config precedence — no value from Firebase OR
// .env blocks the app with a config-error screen. Deliberate per product
// decision (this team always scopes to projects); teamFrom is additionally
// protected by vite's built-in default, so its flag is a safety net in case
// that default is ever removed.
export const CONFIG_FIELDS = [
  { env: 'REFRESH_INTERVAL', key: 'refreshMs', kind: 'interval', hint: 'e.g. 5m, 30s, 1h' },
  { env: 'JIRA_PROJECT', key: 'projects', kind: 'listUpper', required: true, hint: 'Jira project keys, comma-separated (e.g. APP, DX)' },
  { env: 'JIRA_TEAM_FROM', key: 'teamFrom', kind: 'text', required: true, pattern: /^\d{4}-\d{2}-\d{2}$/, patternHint: 'a date like 2024-05-01', hint: 'only issues created since this date (YYYY-MM-DD)' },
  { env: 'CONFLUENCE_SPEC_SPACE', key: 'specSpace', kind: 'text', hint: 'Spec Wizard: Confluence space key (empty = all spaces)' },
  { env: 'SUBTASK_PREFIX_BE', key: 'subtaskPrefixBe', kind: 'text', hint: 'Spec Wizard: BE subtask name prefix' },
  { env: 'SUBTASK_PREFIX_FE', key: 'subtaskPrefixFe', kind: 'text', hint: 'Spec Wizard: FE subtask name prefix' },
  { env: 'SUBTASK_PREFIX_QA', key: 'subtaskPrefixQa', kind: 'text', hint: 'Spec Wizard: QA subtask name prefix' },
  { env: 'INTEGRATION_ROLES', key: 'integrationRoles', kind: 'list', hint: 'Integration Plan target-date columns (e.g. BE, WEB, MOB)' },
  { env: 'BURN_STATUSES', key: 'burnStatuses', kind: 'list', hint: 'statuses that count as "in development" for burn' },
  { env: 'BURN_FINISHED_STATUSES', key: 'burnFinishedStatuses', kind: 'list', hint: 'post-dev statuses where burn shows frozen ("used")' },
  { env: 'QA_EMAILS', key: 'qaEmails', kind: 'list', hint: 'QA Mode team emails, comma-separated' },
  { env: 'QA_BURN_STATUSES', key: 'qaBurnStatuses', kind: 'list', hint: 'QA Mode: statuses QA subtasks burn under' },
  { env: 'QA_BURN_FINISHED_STATUSES', key: 'qaBurnFinishedStatuses', kind: 'list', hint: 'QA Mode: post-QA statuses ("used" stat)' },
  { env: 'WORK_TIME', key: 'workTime', kind: 'worktime', hint: 'burn working windows on work days (e.g. 09:30-12:00,13:00-18:30)' },
  { env: 'WORK_DAYS', key: 'workDays', kind: 'workdays', hint: 'working days for burn + capacity (e.g. Mon,Tue,Wed,Thu,Fri)' },
]

export const parseFieldRaw = (f, raw) =>
  f.kind === 'interval'
    ? parseInterval(raw)
    : f.kind === 'listUpper'
      ? list(raw, true)
      : f.kind === 'list'
        ? list(raw)
        : String(raw).trim()

// Validation for the Settings editor: '' is always valid (= no override).
// Returns an error message, or null when the value is usable.
export function validateFieldRaw(f, raw) {
  const v = String(raw ?? '').trim()
  if (!v) return null
  if (v.includes('"')) return 'must not contain double quotes'
  if (f.kind === 'interval' && parseInterval(v) == null) return `must be ${f.hint}`
  if ((f.kind === 'list' || f.kind === 'listUpper') && !list(v).length)
    return 'must be a comma-separated list'
  if (f.kind === 'worktime' && !parseWorkTime(v))
    return 'must be HH:MM-HH:MM windows, comma-separated, each ending after it starts'
  if (f.kind === 'workdays' && !parseWorkDays(v))
    return 'must be day names, comma-separated (e.g. Mon,Tue,Wed,Thu,Fri)'
  if (f.pattern && !f.pattern.test(v)) return `must be ${f.patternHint}`
  return null
}
