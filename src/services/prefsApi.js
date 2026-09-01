import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'

// Per-user preferences stored at userPrefs/{uid}.
export function watchUserPrefs(uid, cb, onError) {
  return onSnapshot(
    doc(db, 'userPrefs', uid),
    (snap) => cb(snap.exists() ? snap.data() : {}),
    onError,
  )
}

export function setUserPref(uid, patch) {
  return setDoc(doc(db, 'userPrefs', uid), patch, { merge: true })
}
