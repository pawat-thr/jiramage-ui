import { useEffect, useRef, useState } from 'react'
import { cx, chip, chipOn } from '../../utils/ui.js'

const menuItem =
  'block w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink-soft hover:bg-panel hover:text-ink'

export default function FilterMenu({ label, value, options, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const pick = (v) => {
    onPick(v)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button className={cx(chip, value && chipOn)} onClick={() => setOpen(!open)}>
        {label}
        {value ? `: ${value}` : ''} ▾
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-20 max-h-80 min-w-[220px] animate-pop overflow-y-auto rounded-xl border border-line bg-panel-soft p-1.5 shadow-card">
          <button
            className={cx(menuItem, value === '' && 'bg-accent-soft! text-accent-bright!')}
            onClick={() => pick('')}
          >
            All
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              className={cx(menuItem, value === opt && 'bg-accent-soft! text-accent-bright!')}
              onClick={() => pick(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
