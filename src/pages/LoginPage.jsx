import { useState } from 'react'
import { APP_NAME, APP_VERSION, APP_CREDIT } from '../config/appConfig.js'
import { cx } from '../utils/ui.js'
import { validatePassword, PASSWORD_CHECKS } from '../utils/password.js'
import PasswordField from '../components/common/PasswordField.jsx'

const field =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-muted'
const labelCls = 'block text-xs font-medium text-muted mb-1.5'

function CheckIcon({ ok }) {
  return (
    <span
      className={cx(
        'grid size-4 shrink-0 place-items-center rounded-full border text-[10px] font-bold transition-colors',
        ok ? 'border-success bg-success/15 text-success' : 'border-line-strong text-muted',
      )}
      aria-hidden
    >
      {ok ? '✓' : ''}
    </span>
  )
}

// Live password rule checklist — each rule flips green as it passes.
function RuleChecklist({ password, confirm, showMatch }) {
  return (
    <ul className="grid gap-1.5 rounded-xl border border-line bg-panel-soft p-3">
      {PASSWORD_CHECKS.map((c) => {
        const ok = c.test(password)
        return (
          <li
            key={c.id}
            className={cx('flex items-center gap-2 text-xs', ok ? 'text-success' : 'text-muted')}
          >
            <CheckIcon ok={ok} />
            {c.label}
          </li>
        )
      })}
      {showMatch && (
        <li
          className={cx(
            'flex items-center gap-2 text-xs',
            confirm && password === confirm ? 'text-success' : 'text-muted',
          )}
        >
          <CheckIcon ok={!!confirm && password === confirm} />
          Both passwords match
        </li>
      )}
    </ul>
  )
}

export default function LoginPage({ auth }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'activate'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const activate = mode === 'activate'
  const pwReady = !activate || (!validatePassword(password) && password === confirm && !!confirm)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (activate) {
      const pwErr = validatePassword(password)
      if (pwErr) {
        setError(pwErr)
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }
    }
    setBusy(true)
    try {
      if (activate) await auth.activate(email, password)
      else await auth.signIn(email, password)
      // success → onAuthStateChanged in useAuth swaps to the app,
      // and App redirects /login → home.
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (id) => {
    setMode(id)
    setError(null)
    setPassword('')
    setConfirm('')
    setReveal(false)
  }

  const tab = (id, text) => (
    <button
      type="button"
      className={cx(
        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        mode === id
          ? 'bg-panel text-accent-bright shadow-lift'
          : 'text-ink-soft hover:text-ink',
      )}
      onClick={() => switchMode(id)}
    >
      {text}
    </button>
  )

  return (
    // no bg class here — the body paints the theme background (dark = gradient)
    <div className="relative grid min-h-dvh place-items-center overflow-hidden p-5">
      {/* soft accent glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[560px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'var(--color-accent)' }}
      />

      <div className="animate-rise w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <img src="/logo.png" alt="" className="mb-3 size-14 rounded-2xl object-contain shadow-lift" />
          <h1 className="text-2xl font-bold tracking-tight">
            {APP_NAME}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-xs text-muted">Team workspace · members only</p>
        </div>

        <div className="rounded-[18px] border border-line bg-panel p-6 shadow-lift sm:p-7">
          <div className="mb-2 flex gap-1 rounded-xl border border-line bg-field p-1">
            {tab('signin', 'Sign in')}
            {tab('activate', 'First time here')}
          </div>
          <p className="mb-4 text-center text-xs text-muted">
            {activate
              ? 'Use your team email and set your password once.'
              : 'Welcome back — enter your team credentials.'}
          </p>

          {(error || auth.error) && (
            <div className="mb-4 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-[13px] text-danger">
              {error || auth.error}
            </div>
          )}

          <form onSubmit={submit} className="grid gap-4">
            <div>
              <span className={labelCls}>Team email</span>
              <input
                type="email"
                autoComplete="username"
                className={field}
                placeholder="you@orbitdigital.co.th"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted">
                  {activate ? 'Choose a password' : 'Password'}
                </span>
                {activate && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-accent"
                      checked={reveal}
                      onChange={(e) => setReveal(e.target.checked)}
                    />
                    Show
                  </label>
                )}
              </div>
              <PasswordField
                reveal={reveal}
                autoComplete={activate ? 'new-password' : 'current-password'}
                className={field}
                placeholder={activate ? 'Create a strong password' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {activate && (
              <>
                <div>
                  <span className={labelCls}>Confirm password</span>
                  <PasswordField
                    reveal={reveal}
                    autoComplete="new-password"
                    className={field}
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                <RuleChecklist password={password} confirm={confirm} showMatch />
              </>
            )}

            <button
              type="submit"
              disabled={busy || (activate && !pwReady)}
              className="mt-1 w-full rounded-full border border-accent bg-accent-soft px-5 py-3 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Please wait…' : activate ? 'Set password & continue' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted">
            {activate ? (
              <>
                Already activated?{' '}
                <button type="button" className="text-accent-bright hover:underline" onClick={() => switchMode('signin')}>
                  Sign in instead
                </button>
              </>
            ) : (
              <>
                First login?{' '}
                <button type="button" className="text-accent-bright hover:underline" onClick={() => switchMode('activate')}>
                  Activate your account
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted">
          {APP_VERSION} · {APP_CREDIT}
        </p>
      </div>
    </div>
  )
}
