// Theme preference: 'light' | 'dark' | 'system'. The concrete light/dark value
// is written to <html data-theme>, which the CSS tokens key off of.
const KEY = 'jiramage-theme'

export const THEME_OPTIONS = ['light', 'dark', 'system']

export const getThemePref = () => localStorage.getItem(KEY) || 'system'

const prefersDark = () =>
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && prefersDark())
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function setThemePref(pref) {
  localStorage.setItem(KEY, pref)
  applyTheme(pref)
}

// Re-apply when the OS theme changes, but only while preference is "system".
export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (getThemePref() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
