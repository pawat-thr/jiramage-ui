import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null) // { text, error }
  const timer = useRef(null)

  const showToast = useCallback((text, error = false) => {
    clearTimeout(timer.current)
    setToast({ text, error })
    timer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const showError = useCallback(
    (err) => showToast(String(err.message || err), true),
    [showToast],
  )

  return { toast, showToast, showError }
}
