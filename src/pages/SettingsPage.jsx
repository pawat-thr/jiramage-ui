import { useState } from 'react'
import { CFG } from '../config/appConfig.js'
import { card, cx } from '../utils/ui.js'
import { useTheme } from '../hooks/useTheme.js'
import { THEME_OPTIONS } from '../utils/theme.js'
import { firebaseEnabled } from '../services/firebase.js'
import { changePassword } from '../services/firebaseAuth.js'
import { validatePassword, PASSWORD_RULES } from '../utils/password.js'
import { getNotifSound, setNotifSound } from '../utils/prefs.js'
import { playPing } from '../utils/notifSound.js'
import PasswordField from '../components/common/PasswordField.jsx'

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

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <ZoneHeader
        title="Your settings"
        hint="These are yours to change — saved instantly, no restart needed."
      />

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

      {firebaseEnabled && user && (
        <Section title="Account">
          <Row name="Signed in as">{user.email}</Row>
          <div className="mt-1 border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">Change password</h3>
            <p className="mt-0.5 mb-4 text-xs text-muted">
              Confirm your current password, then set a new one.
            </p>
            <ChangePassword onNotify={onNotify} />
          </div>
        </Section>
      )}

      <ZoneHeader
        title="Fixed configuration"
        hint={
          <>
            Read from the <code className="text-accent-bright">.env</code> file and shown here for
            reference only — to change anything below, edit <code>.env</code> and restart the app.
          </>
        }
      />

      <Section title="Connection" locked>
        <Row name="Jira URL">{CFG.jiraUrl}</Row>
        <Row name="Email">{CFG.email}</Row>
        <Row name="API token">••••••••••••••••</Row>
        <Row name="Projects">{CFG.projects.join(', ')}</Row>
      </Section>

      <Section title="Team" locked>
        <Row name="Team members">
          <span className="flex flex-wrap gap-2">
            {[CFG.email, ...CFG.teamEmails].map((e) => (
              <span
                key={e}
                className="rounded-full border border-line bg-field px-3 py-1 text-[13px] text-ink-soft"
              >
                {e}
                {e === CFG.email && <span className="text-muted"> (me)</span>}
              </span>
            ))}
          </span>
        </Row>
        <Row name="Count issues created since">{CFG.teamFrom}</Row>
      </Section>

      <Section title="Preferences" locked>
        <Row name="Auto-refresh interval">{`${Math.round(CFG.refreshMs / 60000)} minutes`}</Row>
        <Row name="Mode">
          {firebaseEnabled ? 'Team (Firebase connected)' : 'Individual (no Firebase env)'}
        </Row>
      </Section>
    </div>
  )
}
