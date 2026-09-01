import { useEffect } from 'react'
import { chip } from '../../utils/ui.js'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  return (
    <div
      className="zoom-normal fixed inset-0 z-50 grid animate-fade place-items-center bg-backdrop p-5"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="w-full max-w-sm animate-pop rounded-[18px] border border-line bg-panel p-6 shadow-lift">
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
          </svg>
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-[13px] text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={chip} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="rounded-full border border-danger bg-danger-soft px-5 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-bg disabled:cursor-wait disabled:opacity-70"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
