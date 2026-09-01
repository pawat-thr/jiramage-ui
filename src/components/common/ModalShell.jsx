import { useEffect } from 'react'
import { chip } from '../../utils/ui.js'

export default function ModalShell({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid animate-fade place-items-center bg-backdrop p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[440px] animate-pop rounded-[18px] border border-line bg-panel p-[22px] shadow-lift"
        role="dialog"
        aria-label={title}
      >
        <h3 className="mb-1 text-base font-semibold">{title}</h3>
        <p className="mb-3.5 text-[13px] text-muted">{subtitle}</p>
        {children}
        <div className="mt-3.5 flex justify-end gap-2">
          <button className={chip} onClick={onClose}>
            Cancel (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
