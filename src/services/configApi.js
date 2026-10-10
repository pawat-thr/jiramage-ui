import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db, firebaseEnabled } from './firebase.js'
import { CFG } from '../config/appConfig.js'
import { CONFIG_FIELDS, parseFieldRaw, validateFieldRaw } from '../config/configFields.js'
import { activeTeamSlug } from './teamsApi.js'

// Team config in Firestore (settings/config): the movable .env fields, stored
// as RAW env-style strings under their env names. Per-field precedence:
//   Firebase value (non-empty)  >  .env value  >  built-in default.
// Loaded once after sign-in and overlaid onto CFG before the app renders, so
// every CFG read in the app picks up the team value automatically. A missing
// REQUIRED field (no Firebase, no .env, no default) blocks the app with a
// config-error screen. Field definitions/parsers live in configFields.js,
// shared with vite.config.js so build-time and runtime parsing can't diverge.
//
// PER-TEAM fields (f.perTeam): with teams active, each team keeps its own
// value as `<ENV>__<team>` on the SAME doc (like promptTemplate_<team>), and
// the team's value wins:  team Firebase > shared Firebase > .env > default.
// The team layer applies in a SECOND applyTeamConfig pass after the roster
// resolves (App.jsx) — the boot pass runs before the team is known.

export { CONFIG_FIELDS, validateFieldRaw }

// Where this field is read/written right now: its team key when teams are
// active and the field is per-team, otherwise the classic shared env key.
export const storeKeyOf = (f) =>
  f.perTeam && activeTeamSlug() ? `${f.env}__${activeTeamSlug()}` : f.env

// Keys that can carry this field's value, strongest first.
const keysOf = (f) => {
  const k = storeKeyOf(f)
  return k === f.env ? [f.env] : [k, f.env]
}

// Current EFFECTIVE CFG value rendered back as an env-style string.
export function cfgToRaw(f) {
  const v = CFG[f.key]
  if (f.kind === 'interval') {
    if (!v) return ''
    if (v % 3600000 === 0) return `${v / 3600000}h`
    if (v % 60000 === 0) return `${v / 60000}m`
    return `${Math.round(v / 1000)}s`
  }
  return Array.isArray(v) ? v.join(', ') : String(v ?? '')
}

// The .env-only values, snapshotted BEFORE the first overlay — this is what
// an overridden field falls back to when its Firebase value is cleared, so
// the Settings placeholder must show THIS, not the overlaid value.
let envBaseline = null
const snapshotEnvBaseline = () => {
  if (!envBaseline) envBaseline = Object.fromEntries(CONFIG_FIELDS.map((f) => [f.env, cfgToRaw(f)]))
}
export function envRawOf(f) {
  snapshotEnvBaseline()
  return envBaseline[f.env]
}

export async function loadTeamConfig() {
  if (!firebaseEnabled) return {}
  const snap = await getDoc(doc(db, 'settings', 'config'))
  return snap.exists() ? snap.data() : {}
}

// localStorage cache so startup never waits on a cold Firestore read: boot
// applies the cached copy instantly, the fresh doc is fetched in the
// background. Saving from Settings writes the cache too, so the editor's
// save-triggered reload always boots with their fresh values.
const LS_KEY = 'jiramage-team-config-v1'
export function cachedTeamConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null')
  } catch {
    return null
  }
}
export function cacheTeamConfig(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data || {}))
  } catch {
    // storage full — cache is an optimization only
  }
}

// Field-wise comparison (trimmed): does `fresh` change anything vs `applied`?
// Per-team fields also compare the active team's key — a change to another
// team's value never prompts this team to reload.
export const configDiffers = (fresh, applied) =>
  CONFIG_FIELDS.some((f) =>
    keysOf(f).some((k) => String(fresh?.[k] ?? '').trim() !== String(applied?.[k] ?? '').trim()),
  )

// Overlays Firebase values onto CFG (mutates it — CFG is read at render/call
// time everywhere, so mutating before the app renders applies globally).
// Empty/invalid values are skipped → the next-weaker value stands. For a
// per-team field the team's value is tried first, then the shared one.
export function applyTeamConfig(data) {
  snapshotEnvBaseline()
  const applied = []
  for (const f of CONFIG_FIELDS) {
    for (const k of keysOf(f)) {
      const raw = data?.[k]
      if (raw == null || String(raw).trim() === '') continue
      const parsed = parseFieldRaw(f, raw)
      if (parsed == null || (Array.isArray(parsed) && !parsed.length)) continue
      CFG[f.key] = parsed
      applied.push(k)
      break
    }
  }
  return applied
}

// Rule 4: after the overlay, a required field with no usable value from
// anywhere (Firebase, .env, default) blocks the app.
export const missingRequired = () =>
  CONFIG_FIELDS.filter((f) => {
    if (!f.required) return false
    const v = CFG[f.key]
    return Array.isArray(v) ? !v.length : !String(v || '').trim()
  }).map((f) => f.env)

export async function saveTeamConfig(data) {
  await setDoc(doc(db, 'settings', 'config'), data, { merge: true })
  // the save-triggered reload must boot with the fresh values — merged into
  // the cached doc, since a save may carry only one editor box's keys
  cacheTeamConfig({ ...(cachedTeamConfig() || {}), ...data })
}

// ---- audit log: who changed the team config ----
// Append-only subcollection settings/config/history — one entry per save with
// only the fields that actually changed. Rules allow create+read, never
// update/delete, so history can't be rewritten.

const historyCol = () => collection(db, 'settings', 'config', 'history')

export function logConfigChange(byEmail, before, after) {
  const changes = {}
  // diff only the keys this save actually carried — a save from one editor
  // box must not log the other box's fields as "cleared"
  for (const k of Object.keys(after || {})) {
    const from = String(before?.[k] ?? '').trim()
    const to = String(after?.[k] ?? '').trim()
    if (from !== to) changes[k] = { from, to }
  }
  if (!Object.keys(changes).length) return Promise.resolve(null)
  return addDoc(historyCol(), { by: byEmail || 'unknown', at: serverTimestamp(), changes })
}

export async function loadConfigHistory(max = 20) {
  const snap = await getDocs(query(historyCol(), orderBy('at', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
