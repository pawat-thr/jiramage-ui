import { useState } from 'react'
import { CFG } from '../config/appConfig.js'
import { card, chip, cx } from '../utils/ui.js'
import { useTheme } from '../hooks/useTheme.js'
import { THEME_OPTIONS } from '../utils/theme.js'
import { firebaseEnabled } from '../services/firebase.js'
import { changePassword } from '../services/firebaseAuth.js'
import { validatePassword, PASSWORD_RULES } from '../utils/password.js'
import PasswordField from '../components/common/PasswordField.jsx'

const label = 'block text-xs font-medium text-muted mb-1.5'
const field =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink-soft disabled:opacity-70'
const editable =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted'

function Section({ title, children }) {
  return (
    <div className={card}>
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="grid gap-4 p-5">{children}</div>
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

// Connection/team/preferences are read-only mocks; Display and Account are live.
export default function SettingsPage({ onNotify, user }) {
  const [theme, setTheme] = useTheme()

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="rounded-xl border border-line bg-panel-soft px-4 py-3 text-[13px] text-muted">
        Most settings here are a mock read from{' '}
        <code className="text-accent-bright">.env</code>. The <strong>Display</strong> theme
        below is live and saved to this browser.
      </div>

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
      </Section>

      {firebaseEnabled && user && (
        <Section title="Account">
          <div>
            <span className={label}>Signed in as</span>
            <input className={field} disabled value={user.email} />
          </div>
          <div className="mt-1 border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">Change password</h3>
            <p className="mt-0.5 mb-4 text-xs text-muted">
              Confirm your current password, then set a new one.
            </p>
            <ChangePassword onNotify={onNotify} />
          </div>
        </Section>
      )}

      <Section title="Connection">
        <div>
          <span className={label}>Jira URL</span>
          <input className={field} disabled value={CFG.jiraUrl} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={label}>Email</span>
            <input className={field} disabled value={CFG.email} />
          </div>
          <div>
            <span className={label}>API token</span>
            <input className={field} disabled type="password" value="••••••••••••••••" />
          </div>
        </div>
        <div>
          <span className={label}>Projects</span>
          <input className={field} disabled value={CFG.projects.join(', ') || '—'} />
        </div>
      </Section>

      <Section title="Team">
        <div>
          <span className={label}>Team members</span>
          <div className="flex flex-wrap gap-2">
            {[CFG.email, ...CFG.teamEmails].map((e) => (
              <span
                key={e}
                className="rounded-full border border-line bg-field px-3 py-1.5 text-[13px] text-ink-soft"
              >
                {e}
                {e === CFG.email && <span className="text-muted"> (me)</span>}
              </span>
            ))}
          </div>
        </div>
        <div>
          <span className={label}>Count issues created since</span>
          <input className={field} disabled value={CFG.teamFrom} />
        </div>
      </Section>

      <Section title="Preferences">
        <div>
          <span className={label}>Auto-refresh interval</span>
          <input className={field} disabled value={`${Math.round(CFG.refreshMs / 60000)} minutes`} />
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          className={chip}
          onClick={() => onNotify('Connection & team settings are read from .env (mock).')}
        >
          Save changes
        </button>
      </div>
    </div>
  )
}
