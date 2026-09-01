import { useState } from 'react'

function EyeIcon({ off }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {off ? (
        <>
          <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.16 3.19M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6" />
          <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
          <path d="M3 3l18 18" />
        </>
      ) : (
        <>
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

// Password input with an inline show/hide eye button. `reveal` (from an outside
// "Show password" checkbox) forces visibility; the eye button toggles per-field.
export default function PasswordField({ reveal = false, className = '', ...props }) {
  const [show, setShow] = useState(false)
  const visible = reveal || show

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        tabIndex={-1}
        // While an outside "Show password" checkbox forces reveal, disable the
        // per-field eye so its state can't desync from the checkbox.
        disabled={reveal}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        onClick={() => setShow((s) => !s)}
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  )
}
