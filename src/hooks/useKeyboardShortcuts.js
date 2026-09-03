import { useEffect } from 'react'

// Global shortcuts like v1: 1-4 switch tabs, h toggles hide-done.
// Skipped while a modal is open or while typing in a form control.
export function useKeyboardShortcuts({ enabled, tabKeys, onTab, onToggleHide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (!enabled || e.metaKey || e.ctrlKey || e.altKey) return
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      // Any open dialog (ModalShell renders role="dialog") suppresses nav keys —
      // covers modals whose state lives outside AppShell (e.g. PromptModal).
      if (document.querySelector('[role="dialog"]')) return
      if (tabKeys[e.key]) onTab(tabKeys[e.key])
      if (e.key === 'h') onToggleHide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, tabKeys, onTab, onToggleHide])
}
