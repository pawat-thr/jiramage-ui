// Small per-browser preferences (like the theme). Empty string = no default.
const RELEASE_KEY = 'jiramage-default-release'

export const getDefaultRelease = () => localStorage.getItem(RELEASE_KEY) || ''

export const setDefaultRelease = (v) => {
  if (v) localStorage.setItem(RELEASE_KEY, v)
  else localStorage.removeItem(RELEASE_KEY)
}
