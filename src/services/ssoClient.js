// Client side of Atlassian SSO: tiny status probe + the silent Firebase
// sign-in. The server (server/ssoPlugin.js) owns all tokens.
import { auth, firebaseEnabled } from './firebase.js'

// Sync-readable flag for UI copy (set once the status probe resolves).
export const ssoFlags = { sso: false }

let statusPromise = null
export function ssoStatus() {
  statusPromise ||= fetch('/auth/status')
    .then((r) => {
      if (!r.ok) throw new Error(`status HTTP ${r.status}`)
      return r.json().then((j) => {
        // UI flag only counts when SSO is USABLE — it needs Firebase for the
        // custom-token sign-in (individual mode always acts as the env token)
        ssoFlags.sso = j.sso && firebaseEnabled
        return j
      })
    })
    .catch(() => {
      // transient failure (server restart / HMR blip) must NOT be cached as
      // "SSO is off" for the page's lifetime — retry on the next call
      statusPromise = null
      return { sso: false, email: null }
    })
  return statusPromise
}

// After the OAuth callback the server holds a session + a Firebase custom
// token; exchange it for a real Firebase sign-in (no password anywhere).
export async function ssoSession() {
  const r = await fetch('/auth/session')
  return r.ok ? r.json() : null
}

export function ssoLogout() {
  return fetch('/auth/logout', { method: 'POST' }).catch(() => {})
}

// Whitelist listing (Firebase Auth users) for Teamage — null when SSO is off
// or the caller has no session.
export async function fetchAuthUsers() {
  try {
    const idToken = await auth?.currentUser?.getIdToken().catch(() => null)
    const r = await fetch('/auth/users', idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : undefined)
    if (!r.ok) return null
    return (await r.json()).users || []
  } catch {
    return null
  }
}
