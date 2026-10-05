import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, firebaseEnabled } from './firebase.js'
import { CFG } from '../config/appConfig.js'

// Profile pictures. Team mode: one small Firestore doc per member in
// `profiles/{email}` holding a resized data-URL (~10KB — far under the 1MB
// doc limit, so no Firebase Storage needed); everyone sees everyone's photo
// live via onSnapshot. Individual mode: your own photo in localStorage.
// No photo anywhere → the classic initials-on-color avatar stands.

const LS_KEY = 'jiramage-profile-photo'

let photos = {} // lowercase email -> dataURL
const subs = new Set()
const emit = () => subs.forEach((cb) => cb())

export const photoOf = (id) => photos[String(id || '').toLowerCase()] || null

export function subscribeProfiles(cb) {
  subs.add(cb)
  return () => subs.delete(cb)
}

// Lazy start on first Avatar mount — by then the user is signed in, so the
// Firestore read passes the rules.
let started = false
export function startProfiles() {
  if (started) return
  started = true
  if (!firebaseEnabled) {
    try {
      const p = localStorage.getItem(LS_KEY)
      if (p) photos = { [(CFG.email || '').toLowerCase()]: p }
    } catch {
      // corrupt storage → initials fallback
    }
    emit()
    return
  }
  onSnapshot(
    collection(db, 'profiles'),
    (snap) => {
      const next = {}
      snap.forEach((d) => {
        if (d.data()?.photo) next[d.id.toLowerCase()] = d.data().photo
      })
      photos = next
      emit()
    },
    () => {}, // offline/permission hiccup → initials fallback
  )
}

export async function saveMyPhoto(email, dataUrl) {
  const key = String(email || CFG.email || '').toLowerCase()
  if (!firebaseEnabled) {
    localStorage.setItem(LS_KEY, dataUrl)
    photos = { ...photos, [key]: dataUrl }
    emit()
    return
  }
  await setDoc(doc(db, 'profiles', key), { photo: dataUrl, updatedAt: serverTimestamp() })
}

export async function removeMyPhoto(email) {
  const key = String(email || CFG.email || '').toLowerCase()
  if (!firebaseEnabled) {
    localStorage.removeItem(LS_KEY)
    const { [key]: _gone, ...rest } = photos
    photos = rest
    emit()
    return
  }
  await deleteDoc(doc(db, 'profiles', key))
}

// File -> square cover-cropped JPEG data-URL (default 128px ≈ 5–15KB).
export function fileToAvatar(file, size = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const s = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Could not read that image'))
    }
    img.src = URL.createObjectURL(file)
  })
}
