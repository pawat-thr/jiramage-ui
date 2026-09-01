import { useState } from 'react'
import { APP_NAME, APP_VERSION, APP_CREDIT } from '../config/appConfig.js'
import { cx } from '../utils/ui.js'
import { validatePassword, PASSWORD_RULES } from '../utils/password.js'
import PasswordField from '../components/common/PasswordField.jsx'

const field =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-muted'
const labelCls = 'block text-xs font-medium text-muted mb-1.5'

export default function LoginPage({ auth }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'activate'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const activate = mode === 'activate'

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
      // success → onAuthStateChanged in useAuth swaps to the app
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const tab = (id, text) => (
    <button
      type="button"
      className={cx(
        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        mode === id ? 'bg-accent-soft text-accent-bright' : 'text-ink-soft hover:text-ink',
      )}
      onClick={() => {
        setMode(id)
        setError(null)
      }}
    >
      {text}
    </button>
  )

  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-5">
      <div className="w-full max-w-sm rounded-[18px] border border-line bg-panel p-8 shadow-lift">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="" className="mb-3 size-12 rounded-xl object-contain" />
          <h1 className="text-2xl font-bold tracking-tight">
            {APP_NAME}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-xs text-muted">
            {APP_VERSION} · {APP_CREDIT}
          </p>
        </div>

        <div className="mb-5 flex gap-1 rounded-xl border border-line bg-field p-1">
          {tab('signin', 'Sign in')}
          {tab('activate', 'First time')}
        </div>

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
            <span className={labelCls}>{activate ? 'Choose a password' : 'Password'}</span>
            <PasswordField
              reveal={reveal}
              autoComplete={activate ? 'new-password' : 'current-password'}
              className={field}
              placeholder={activate ? 'Create a strong password' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {activate && <p className="mt-1.5 text-xs text-muted">{PASSWORD_RULES}</p>}
          </div>
          {activate && (
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
          )}
          {activate && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={reveal}
                onChange={(e) => setReveal(e.target.checked)}
              />
              Show password
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full rounded-full border border-accent bg-accent-soft px-5 py-3 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? 'Please wait…' : activate ? 'Set password & continue' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          {activate
            ? 'First time here? Choose a password to activate your account.'
            : 'Only team members can sign in.'}
        </p>
      </div>
    </div>
  )
}
