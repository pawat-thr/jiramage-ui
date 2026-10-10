import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CFG, teamMembers } from '../config/appConfig.js'
import { card, cx } from '../utils/ui.js'
import { useTheme } from '../hooks/useTheme.js'
import { THEME_OPTIONS } from '../utils/theme.js'
import { firebaseEnabled } from '../services/firebase.js'
import { changePassword } from '../services/firebaseAuth.js'
import { validatePassword, PASSWORD_RULES } from '../utils/password.js'
import { getNotifSound, setNotifSound } from '../utils/prefs.js'
import { ssoStatus } from '../services/ssoClient.js'
import { playPing } from '../utils/notifSound.js'
import {
  watchPromptTemplate,
  savePromptTemplate,
  linkParamCount,
  DEFAULT_PROMPT_TEMPLATE,
} from '../services/settingsApi.js'
import PasswordField from '../components/common/PasswordField.jsx'
import Avatar from '../components/common/Avatar.jsx'
import { fileToAvatar, saveMyPhoto, removeMyPhoto, photoOf, subscribeProfiles, startProfiles } from '../services/profilesApi.js'
import {
  CONFIG_FIELDS,
  cfgToRaw,
  envRawOf,
  storeKeyOf,
  validateFieldRaw,
  loadTeamConfig,
  saveTeamConfig,
  logConfigChange,
  loadConfigHistory,
} from '../services/configApi.js'
import { activeTeamSlug, teamsEnabled } from '../services/teamsApi.js'
import { emailUsername } from '../utils/format.js'

const label = 'block text-xs font-medium text-muted mb-1.5'
const editable =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted'

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

// `locked` sections show a "Fixed · .env" badge and render values as plain
// read-only rows instead of fake form inputs.
function Section({ title, locked, children }) {
  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {locked ? (
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-field px-2.5 py-1 text-[11px] font-medium text-muted">
            <LockIcon />
            Fixed · .env
          </span>
        ) : (
          <span className="rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-bright">
            Editable
          </span>
        )}
      </div>
      <div className="grid gap-4 p-5">{children}</div>
    </div>
  )
}

// The env roster rendered as chips, with "(me)" on the signed-in user.
function MemberChips() {
  return (
    <span className="flex flex-wrap gap-2">
      {teamMembers().map((e) => (
        <span
          key={e}
          className="rounded-full border border-line bg-field px-3 py-1 text-[13px] text-ink-soft"
        >
          {e}
          {e === CFG.email && <span className="text-muted"> (me)</span>}
        </span>
      ))}
    </span>
  )
}

// One read-only config row: label on the left, value on the right.
function Row({ name, children }) {
  return (
    <div className="grid items-baseline gap-1 sm:grid-cols-[180px_1fr] sm:gap-4">
      <span className="text-xs font-medium text-muted">{name}</span>
      <span className="min-w-0 text-sm break-words text-ink-soft">{children || '—'}</span>
    </div>
  )
}

function ChangePassword({ onNotify }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const pwErr = validatePassword(next)
    if (pwErr) return onNotify(pwErr, true)
    if (next !== confirm) return onNotify('Passwords do not match.', true)
    setBusy(true)
    try {
      await changePassword(current, next)
      onNotify('✓ Password changed')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <span className={label}>Current password</span>
        <PasswordField
          autoComplete="current-password"
          className={editable}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={label}>New password</span>
          <PasswordField
            autoComplete="new-password"
            className={editable}
            placeholder="Strong password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div>
          <span className={label}>Confirm new password</span>
          <PasswordField
            autoComplete="new-password"
            className={editable}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted">{PASSWORD_RULES}</p>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}

const THEME_LABELS = { light: 'Light', dark: 'Dark', system: 'System' }

// Profile picture: team mode saves to Firestore (whole team sees it);
// individual mode saves to this browser. No photo = the initials avatar.
function ProfilePhoto({ onNotify, user }) {
  const email = user?.email || CFG.email
  useEffect(() => startProfiles(), [])
  const photo = useSyncExternalStore(subscribeProfiles, () => photoOf(email))
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToAvatar(file)
      await saveMyPhoto(email, dataUrl)
      onNotify(firebaseEnabled ? '✓ Profile picture saved — the whole team sees it' : '✓ Profile picture saved to this browser')
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar
        id={email}
        name={emailUsername(email)}
        className="grid size-16 place-items-center rounded-full text-xl font-bold text-bg"
      />
      <div className="grid gap-1.5">
        <div className="flex gap-2">
          <button
            disabled={busy}
            className="rounded-full border border-accent bg-accent-soft px-4 py-1.5 text-[13px] font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:opacity-60"
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Saving…' : photo ? 'Change picture' : 'Upload picture'}
          </button>
          {photo && (
            <button
              className="rounded-full border border-line bg-field px-4 py-1.5 text-[13px] text-ink-soft hover:border-danger hover:text-danger"
              onClick={async () => {
                try {
                  await removeMyPhoto(email)
                  onNotify('✓ Back to the initials avatar')
                } catch (e) {
                  onNotify(e.message, true)
                }
              }}
            >
              Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }}
          />
        </div>
        <p className="text-xs text-muted">
          Cropped square, resized to 128px.{' '}
          {firebaseEnabled ? 'Shown to the whole team everywhere avatars appear.' : 'Saved to this browser (no Firebase).'}{' '}
          No picture = your initials avatar.
        </p>
      </div>
    </div>
  )
}

// One editor box over a SUBSET of the config fields. Reads/writes each
// field under storeKeyOf (per-team fields → the team's own key when teams
// are active) — or, with `sharedKeys`, always under the plain env key (the
// shared box edits every team's fallback, per-team fields included).
// Merge-saves ONLY its own keys and shows only the history entries that
// touched them.
function ConfigEditor({ fields, saved, history, saveLabel, sharedKeys, onNotify, user }) {
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)

  const team = activeTeamSlug()
  const keyFn = sharedKeys ? (f) => f.env : storeKeyOf
  const valueOf = (f) => draft[keyFn(f)] ?? saved[keyFn(f)] ?? ''
  const dirty = fields.some((f) => valueOf(f) !== (saved[keyFn(f)] ?? ''))

  const errors = Object.fromEntries(
    fields.map((f) => [f.env, validateFieldRaw(f, valueOf(f))]).filter(([, e]) => e),
  )

  // This box's slice of the change history: the team box shows my team's
  // keys (ENV__team), the shared box shows plain keys — so legacy entries
  // (logged before the split) stay visible in the shared box and OTHER
  // teams' changes appear in neither.
  const mine = new Set(fields.map(keyFn))
  const slices = history
    .map((h) => ({ ...h, changes: Object.fromEntries(Object.entries(h.changes || {}).filter(([k]) => mine.has(k))) }))
    .filter((h) => Object.keys(h.changes).length)

  const save = async () => {
    if (Object.keys(errors).length) {
      onNotify('Fix the highlighted fields first — invalid values would break Jira queries for the whole team', true)
      return
    }
    setBusy(true)
    try {
      // merge-write only the keys this box owns — shared values and other
      // teams' keys are never touched by this save
      const data = Object.fromEntries(fields.map((f) => [keyFn(f), String(valueOf(f)).trim()]))
      await saveTeamConfig(data)
      // audit log: who changed what (append-only; failure must not block the save)
      await logConfigChange(user?.email, saved, data).catch(() => {})
      onNotify('✓ Team config saved — reloading to apply…')
      setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      onNotify(err.message, true)
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      {fields.map((f) => {
        const perTeam = !sharedKeys && f.perTeam && team
        const overridden = String(saved[keyFn(f)] ?? '').trim() !== ''
        // what an EMPTY input falls back to: shared Firebase value (per-team
        // fields only), then .env
        const sharedRaw = perTeam ? String(saved[f.env] ?? '').trim() : ''
        const fallback = sharedRaw
          ? `shared: ${sharedRaw}`
          : envRawOf(f)
            ? `.env: ${envRawOf(f)}`
            : '(not set in .env)'
        return (
          <div key={f.env}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-medium text-muted">
                {f.env}
                {sharedKeys && f.perTeam && team && (
                  <span
                    className="ml-1.5 rounded-full border border-line bg-field px-1.5 py-[1px] font-sans text-[10px] font-medium text-muted"
                    title="Per-team field: this shared value is the FALLBACK for teams without their own"
                  >
                    fallback
                  </span>
                )}
              </span>
              <span
                className={cx(
                  'rounded-full border px-2 py-[1px] text-[10px] font-medium',
                  overridden
                    ? 'border-violet/50 bg-violet-soft text-violet'
                    : 'border-line bg-field text-muted',
                )}
                title={
                  overridden
                    ? perTeam
                      ? `This value is team ${team.toUpperCase()}'s own and overrides the shared/.env value`
                      : 'This value comes from Firebase and overrides .env'
                    : perTeam && sharedRaw
                      ? 'No team value — the shared Firebase value applies'
                      : 'No override — the .env value applies'
                }
              >
                {overridden ? (perTeam ? `team ${team}` : 'Firebase') : sharedRaw ? 'shared' : '.env'}
              </span>
            </div>
            <input
              aria-label={keyFn(f)}
              className={cx(editable, errors[f.env] && 'border-danger')}
              value={valueOf(f)}
              placeholder={fallback}
              onChange={(e) => setDraft((d) => ({ ...d, [keyFn(f)]: e.target.value }))}
            />
            <p className={cx('mt-1 text-xs', errors[f.env] ? 'text-danger' : 'text-muted')}>
              {errors[f.env] || f.hint}
            </p>
          </div>
        )
      })}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          Empty field = use the fallback shown greyed
          {fields.some((f) => f.perTeam && team) ? ' (shared value, then ' : ' ('}
          <code>.env</code>). Saving reloads the app for you; teammates get a "reload to apply"
          prompt.
        </span>
        <button
          disabled={!dirty || busy || Object.keys(errors).length > 0}
          onClick={save}
          className="shrink-0 rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : saveLabel}
        </button>
      </div>

      {slices.length > 0 && (
        <div className="border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Change history</h3>
          <p className="mt-0.5 mb-3 text-xs text-muted">
            Who changed these fields (append-only — last {slices.length} saves).
          </p>
          <div className="grid gap-2.5">
            {slices.map((h) => (
              <div key={h.id} className="rounded-xl border border-line bg-field px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">
                    {emailUsername(h.by || '') || h.by}
                  </span>
                  <span className="text-xs text-muted">
                    {h.at?.toDate ? h.at.toDate().toLocaleString() : '…'}
                  </span>
                </div>
                <div className="mt-1 grid gap-0.5">
                  {Object.entries(h.changes).map(([field, c]) => (
                    <div key={field} className="truncate text-xs" title={`${field}: "${c.from}" → "${c.to}"`}>
                      <span className="font-mono text-muted">{field}</span>{' '}
                      <span className="text-ink-soft">{c.from || '(empty)'}</span>
                      <span className="text-muted"> → </span>
                      <span className="text-accent-bright">{c.to || '(empty)'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Movable team config: Firestore (settings/config) overrides .env per field.
// Empty input = no override → the fallback (shared value / .env) applies.
// With teams active the editor splits into TWO boxes: your team's own
// settings (saved as ENV__<team>) and the shared config every team inherits.
// Saving reloads the page so the overlay re-applies everywhere.
export function TeamConfig({ onNotify, user }) {
  const [saved, setSaved] = useState(null) // stored doc (null = loading)
  const [history, setHistory] = useState([])

  useEffect(() => {
    let on = true
    loadConfigHistory().then((h) => on && setHistory(h)).catch(() => {})
    loadTeamConfig()
      .then((d) => on && setSaved(d))
      .catch((err) => {
        if (!on) return
        onNotify(err.message, true)
        setSaved({})
      })
    return () => {
      on = false
    }
  }, [])

  const team = activeTeamSlug()
  const loading = <p className="text-[13px] text-muted">Loading team config…</p>

  if (!team) {
    // teams off → the classic single box over every field
    return (
      <Section title="Team config">
        {saved === null ? loading : (
          <ConfigEditor
            fields={CONFIG_FIELDS}
            saved={saved}
            history={history}
            saveLabel="Save team config"
            onNotify={onNotify}
            user={user}
          />
        )}
      </Section>
    )
  }

  const teamFields = CONFIG_FIELDS.filter((f) => f.perTeam)
  return (
    <>
      <Section title={`Team ${team.toUpperCase()} settings`}>
        <p className="-mt-1 text-xs text-muted">
          These values belong to team {team.toUpperCase()} only — other teams keep their own.
          Empty = inherit the shared value below (then <code>.env</code>). The Dev Prompt is
          per team too, in its own box above.
        </p>
        {saved === null ? loading : (
          <ConfigEditor
            fields={teamFields}
            saved={saved}
            history={history}
            saveLabel={`Save team ${team.toUpperCase()}`}
            onNotify={onNotify}
            user={user}
          />
        )}
      </Section>
      <Section title="Shared config · all teams">
        <p className="-mt-1 text-xs text-muted">
          One value for every team — changing it here affects everyone. Fields marked{' '}
          <em>fallback</em> are per-team: the value here applies only to teams that
          haven't set their own above.
        </p>
        {saved === null ? loading : (
          <ConfigEditor
            fields={CONFIG_FIELDS}
            saved={saved}
            history={history}
            saveLabel="Save shared config"
            sharedKeys
            onNotify={onNotify}
            user={user}
          />
        )}
      </Section>
    </>
  )
}

// Team-shared dev prompt template. Must contain {link} exactly once — it gets
// replaced by a card's Confluence spec URL when generating a prompt.
function PromptTemplate({ onNotify }) {
  const [saved, setSaved] = useState(DEFAULT_PROMPT_TEMPLATE)
  const [draft, setDraft] = useState(null) // null = follow saved
  const [busy, setBusy] = useState(false)
  const areaRef = useRef(null)
  useEffect(() => watchPromptTemplate(setSaved), [])

  const value = draft ?? saved
  const count = linkParamCount(value)
  const valid = count === 1 && value.trim().length > 0
  const dirty = draft !== null && draft !== saved

  // Quick-insert {link} at the caret — only while the template doesn't have
  // one yet (the rule is exactly 1, so the button disables after that).
  const insertLink = () => {
    const el = areaRef.current
    const pos = el && document.activeElement === el ? el.selectionStart : value.length
    const before = value.slice(0, pos)
    const after = value.slice(pos)
    const token =
      (before && !/\s$/.test(before) ? ' ' : '') + '{link}' + (after && !/^\s/.test(after) ? ' ' : '')
    setDraft(before + token + after)
    const caret = (before + token).length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  const save = async () => {
    setBusy(true)
    try {
      await savePromptTemplate(value.trim())
      setDraft(null)
      onNotify(
        activeTeamSlug()
          ? `✓ Prompt template saved for team ${activeTeamSlug().toUpperCase()}`
          : '✓ Prompt template saved for the whole team',
      )
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">Template</span>
        <button
          type="button"
          disabled={count >= 1}
          // keep focus (and the caret) in the textarea so insert-at-cursor works
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          title={
            count >= 1
              ? '{link} is already in the template — exactly 1 is allowed'
              : 'Insert {link} at the cursor'
          }
          className="rounded-full border border-line bg-field px-3 py-1 font-mono text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          + {'{link}'}
        </button>
      </div>
      <textarea
        ref={areaRef}
        className={`${editable} min-h-20 resize-y font-mono text-[13px]`}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={DEFAULT_PROMPT_TEMPLATE}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${valid ? 'text-muted' : 'text-danger'}`}>
          {count === 1
            ? 'Contains {link} once — the card’s spec URL replaces it.'
            : count === 0
              ? 'Missing {link} — the template must contain it exactly once.'
              : `{link} appears ${count} times — exactly 1 is required.`}
        </span>
        <button
          disabled={!valid || !dirty || busy}
          onClick={save}
          className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save template'}
        </button>
      </div>
    </div>
  )
}

function ZoneHeader({ title, hint }) {
  return (
    <div className="mt-2 first:mt-0">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  )
}

// Display + Account are live settings; everything below is read from .env.
export default function SettingsPage({ onNotify, user }) {
  const [theme, setTheme] = useTheme()
  const [soundOn, setSoundOn] = useState(getNotifSound())
  const [ssoOn, setSsoOn] = useState(false)
  useEffect(() => {
    ssoStatus().then((st) => setSsoOn(st.sso))
  }, [])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <ZoneHeader
        title="Your settings"
        hint="These are yours to change — saved instantly, no restart needed."
      />

      <Section title="Profile">
        <ProfilePhoto onNotify={onNotify} user={user} />
      </Section>

      <Section title="Display">
        <div>
          <span className={label}>Theme</span>
          <div className="inline-flex rounded-xl border border-line bg-field p-1">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={cx(
                  'rounded-lg px-5 py-2 text-sm font-medium transition-colors',
                  theme === opt
                    ? 'bg-accent-soft text-accent-bright'
                    : 'text-ink-soft hover:text-ink',
                )}
                onClick={() => setTheme(opt)}
              >
                {THEME_LABELS[opt]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            “System” follows your device’s light/dark setting.
          </p>
        </div>
        {firebaseEnabled && (
          <div className="border-t border-line pt-4">
            <span className={label}>Notification sound</span>
            <div className="inline-flex rounded-xl border border-line bg-field p-1">
              {[
                [true, 'On'],
                [false, 'Off'],
              ].map(([on, text]) => (
                <button
                  key={text}
                  className={cx(
                    'rounded-lg px-5 py-2 text-sm font-medium transition-colors',
                    soundOn === on
                      ? 'bg-accent-soft text-accent-bright'
                      : 'text-ink-soft hover:text-ink',
                  )}
                  onClick={() => {
                    setNotifSound(on)
                    setSoundOn(on)
                    if (on) playPing()
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Plays a short ping when a new inbox notification arrives, and a softer reminder
              every {Math.round(CFG.refreshMs / 60000)} minutes while unread items remain. Saved
              to this browser.
            </p>
          </div>
        )}
      </Section>

      <Section title="Dev Prompt">
        <p className="-mt-1 text-xs text-muted">
          {firebaseEnabled
            ? activeTeamSlug()
              ? `Team ${activeTeamSlug().toUpperCase()}'s own template — every team keeps its own.`
              : 'Shared with the whole team — everyone generates prompts from this template.'
            : 'Saved to this browser (no Firebase configured).'}{' '}
          Use the ⚡ Prompt button on My Tasks / Team Task cards that have a Spec link.
        </p>
        <PromptTemplate onNotify={onNotify} />
      </Section>

      {firebaseEnabled && user && (
        <Section title="Account">
          <Row name="Signed in as">{user.email}</Row>
          {ssoOn ? (
            <p className="text-xs text-muted">
              Signed in with Atlassian (SSO) — no app password exists; manage
              your credentials at id.atlassian.com.
            </p>
          ) : (
            <div className="mt-1 border-t border-line pt-5">
              <h3 className="text-sm font-semibold text-ink">Change password</h3>
              <p className="mt-0.5 mb-4 text-xs text-muted">
                Confirm your current password, then set a new one.
              </p>
              <ChangePassword onNotify={onNotify} />
            </div>
          )}
        </Section>
      )}

      {firebaseEnabled ? (
        <>
          <ZoneHeader
            title="Team configuration"
            hint="Shared via Firebase and applied live. Each field overrides its fallback; leave a field empty to keep inheriting it."
          />
          <TeamConfig onNotify={onNotify} user={user} />
        </>
      ) : (
        <>
          <ZoneHeader
            title="Team configuration"
            hint="Read from .env (no Firebase configured — with Firebase these become editable here for the whole team)."
          />
          <Section title="Team config" locked>
            {CONFIG_FIELDS.map((f) => (
              <Row key={f.env} name={f.env}>
                {cfgToRaw(f)}
              </Row>
            ))}
          </Section>
        </>
      )}

      <ZoneHeader
        title="Fixed configuration"
        hint={
          <>
            Read from the <code className="text-accent-bright">.env</code> file and shown here for
            reference only — to change anything below, edit <code>.env</code> and restart the app.
            {firebaseEnabled && ' Only values that are still fixed in team mode are listed.'}
          </>
        }
      />

      {firebaseEnabled ? (
        // Team mode: most values moved above (editable team config), your
        // email is the login (Account box) and with teams the roster lives in
        // Teamage — so only the truly fixed leftovers are shown here.
        <Section title="Connection" locked>
          <Row name="Jira URL">{CFG.jiraUrl}</Row>
          {!ssoOn && <Row name="API token">••••••••••••••••</Row>}
          <Row name="Jira access">
            {ssoOn ? 'Your Atlassian login (SSO) — no shared token' : 'Shared API token from .env'}
          </Row>
          <Row name="Mode">Team (Firebase connected)</Row>
          {!teamsEnabled() && (
            <Row name="Team members">
              <MemberChips />
            </Row>
          )}
        </Section>
      ) : (
        <>
          <Section title="Connection" locked>
            <Row name="Jira URL">{CFG.jiraUrl}</Row>
            <Row name="Email">{CFG.email}</Row>
            <Row name="API token">••••••••••••••••</Row>
            <Row name="Projects">{CFG.projects.join(', ')}</Row>
          </Section>

          <Section title="Team" locked>
            <Row name="Team members">
              <MemberChips />
            </Row>
            <Row name="Count issues created since">{CFG.teamFrom}</Row>
          </Section>

          <Section title="Preferences" locked>
            <Row name="Auto-refresh interval">{`${Math.round(CFG.refreshMs / 60000)} minutes`}</Row>
            <Row name="Mode">Individual (no Firebase env)</Row>
          </Section>
        </>
      )}
    </div>
  )
}
