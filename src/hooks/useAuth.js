import { useEffect, useState } from 'react'
import { firebaseEnabled } from '../services/firebase.js'
import { watchAuth, signIn, activate, logout, isAllowed, signInWithSsoToken } from '../services/firebaseAuth.js'
import { ssoStatus, ssoSession, ssoLogout } from '../services/ssoClient.js'
import { CFG } from '../config/appConfig.js'
import { emailUsername } from '../utils/format.js'

const mapUser = (u) => {
  if (!u) return null
  // Deploy model: the LOGIN user overwrites JIRA_EMAIL — "me" everywhere
  // ((me) badges, isMe stats, attribution hints) follows who signed in, so
  // the deployed .env needs no individual's email at all.
  CFG.email = (u.email || CFG.email || '').toLowerCase()
  return { name: u.displayName || emailUsername(u.email || ''), email: u.email || '', uid: u.uid }
}

// Individual mode (no Firebase): the single user is the configured JIRA_EMAIL,
// no login required.
const individualUser = { name: emailUsername(CFG.email || 'user'), email: CFG.email || '' }

export function useAuth() {
  const [user, setUser] = useState(firebaseEnabled ? null : individualUser)
  const [ready, setReady] = useState(!firebaseEnabled)
  const [error, setError] = useState(null)
  const [sso, setSso] = useState(false)

  useEffect(() => {
    if (!firebaseEnabled) return
    let triedSession = false
    return watchAuth(async (u) => {
      // Resolve SSO mode FIRST (memoized — instant after the first call):
      // Firebase can restore a persisted user from IndexedDB before an async
      // status probe lands, and the env-allowlist guard below must never run
      // against an SSO user.
      const ssoMode = (await ssoStatus()).sso
      setSso(ssoMode)
      // SSO mode: no Firebase user yet -> try the server session once (the
      // OAuth callback leaves a custom token waiting). Whitelist = the email
      // already existing as a Firebase Auth user — the SERVER enforced that.
      if (!u && !triedSession) {
        triedSession = true
        if (ssoMode) {
          const sess = await ssoSession().catch(() => null)
          if (sess?.customToken) {
            try {
              await signInWithSsoToken(sess.customToken)
              return // watchAuth fires again with the signed-in user
            } catch (e) {
              // e.g. service account belongs to a DIFFERENT Firebase project
              // than the web config — surface it on the login page
              setError(`SSO sign-in failed: ${e?.code || e?.message || e}`)
            }
          }
        }
      }
      // Defense in depth (password mode only): the env allowlist. In SSO
      // mode the server already checked the Firebase-user whitelist.
      if (u && !ssoMode && !isAllowed(u.email)) {
        setError('This account is not on the team allowlist.')
        try {
          await logout()
        } catch {
          // ignore sign-out failure; user state is cleared regardless
        }
        setUser(null)
      } else {
        setUser(mapUser(u))
      }
      setReady(true)
    })
  }, [])

  // Logout clears BOTH the Firebase session and the server-side SSO session.
  const logoutAll = async () => {
    await ssoLogout()
    await logout()
  }

  return { configured: firebaseEnabled, ready, user, error, sso, signIn, activate, logout: logoutAll }
}
