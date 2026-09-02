// Small per-browser preferences (like the theme). Empty string = no default.
const RELEASE_KEY = 'jiramage-default-release'

export const getDefaultRelease = () => localStorage.getItem(RELEASE_KEY) || ''

export const setDefaultRelease = (v) => {
  if (v) localStorage.setItem(RELEASE_KEY, v)
  else localStorage.removeItem(RELEASE_KEY)
}

// Notification sound on/off (per browser). Default: on.
const SOUND_KEY = 'jiramage-notif-sound'

export const getNotifSound = () => localStorage.getItem(SOUND_KEY) !== 'off'

export const setNotifSound = (on) => {
  if (on) localStorage.removeItem(SOUND_KEY)
  else localStorage.setItem(SOUND_KEY, 'off')
}
