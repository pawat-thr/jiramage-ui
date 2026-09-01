import { useEffect, useState } from 'react'
import { firebaseEnabled } from '../services/firebase.js'
import { watchAuth, signIn, activate, logout, isAllowed } from '../services/firebaseAuth.js'
import { CFG } from '../config/appConfig.js'
import { emailUsername } from '../utils/format.js'

const mapUser = (u) =>
  u && { name: u.displayName || emailUsername(u.email || ''), email: u.email || '', uid: u.uid }

// Individual mode (no Firebase): the single user is the configured JIRA_EMAIL,
// no login required.
const individualUser = { name: emailUsername(CFG.email || 'user'), email: CFG.email || '' }

export function useAuth() {
  const [user, setUser] = useState(firebaseEnabled ? null : individualUser)
  const [ready, setReady] = useState(!firebaseEnabled)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!firebaseEnabled) return
    return watchAuth(async (u) => {
      // Defense in depth: if a signed-in account isn't allowlisted, sign it out.
      if (u && !isAllowed(u.email)) {
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

  return { configured: firebaseEnabled, ready, user, error, signIn, activate, logout }
}
