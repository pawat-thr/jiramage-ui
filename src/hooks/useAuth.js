import { useEffect, useState } from 'react'
import { firebaseEnabled } from '../services/firebase.js'
import { watchAuth, signIn, activate, logout, isAllowed } from '../services/firebaseAuth.js'
import { emailUsername } from '../utils/format.js'

const mapUser = (u) =>
  u && { name: u.displayName || emailUsername(u.email || ''), email: u.email || '' }

export function useAuth() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!firebaseEnabled)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!firebaseEnabled) return
    return watchAuth(async (u) => {
      // Defense in depth: if a signed-in account isn't allowlisted, sign it out.
      if (u && !isAllowed(u.email)) {
        setError('This account is not on the team allowlist.')
        await logout()
        setUser(null)
      } else {
        setUser(mapUser(u))
      }
      setReady(true)
    })
  }, [])

  return { configured: firebaseEnabled, ready, user, error, signIn, activate, logout }
}
