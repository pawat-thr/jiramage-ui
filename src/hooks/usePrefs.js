import { useEffect, useState } from 'react'
import { firebaseEnabled } from '../services/firebase.js'
import { watchUserPrefs, setUserPref } from '../services/prefsApi.js'
import { getDefaultRelease as lsGet, setDefaultRelease as lsSet } from '../utils/prefs.js'

// Default-release preference: stored in Firestore per user (team mode), or in
// localStorage when there's no signed-in Firebase user (individual mode).
export function usePrefs(user) {
  const cloud = firebaseEnabled && !!user?.uid
  const [defaultRelease, setRelease] = useState(cloud ? '' : lsGet())

  useEffect(() => {
    if (!cloud) return
    return watchUserPrefs(
      user.uid,
      (data) => setRelease(data.defaultRelease || ''),
      () => {}, // ignore read errors (e.g. rules not yet set) — falls back to no default
    )
  }, [cloud, user?.uid])

  const setDefaultRelease = (v) => {
    setRelease(v)
    if (cloud) setUserPref(user.uid, { defaultRelease: v }).catch(() => {})
    else lsSet(v)
  }

  return { defaultRelease, setDefaultRelease }
}
