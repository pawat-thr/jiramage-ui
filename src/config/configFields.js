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
  if (f.pattern && !f.pattern.test(v)) return `must be ${f.patternHint}`
  return null
}
