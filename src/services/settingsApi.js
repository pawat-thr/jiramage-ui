import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db, firebaseEnabled } from './firebase.js'

// Team-wide (global) app settings, shared by every member via Firestore.
// Individual mode (no Firebase) falls back to this browser's localStorage.

const LS_KEY = 'jiramage-prompt-template'

export const DEFAULT_PROMPT_TEMPLATE =
  'help me to enhance {link} use skill unit test after implement'

// The template must contain the {link} param exactly once.
export const linkParamCount = (t) => ((t || '').match(/\{link\}/g) || []).length

export const buildPrompt = (template, url) => (template || '').replaceAll('{link}', url)

// Local-mode watchers: notified after every save, so the Settings box and the
// ⚡ Prompt popup update live (Firestore mode gets this via onSnapshot).
const localWatchers = new Set()

export function watchPromptTemplate(cb, onError = () => {}) {
  if (!firebaseEnabled) {
    const notify = () => cb(localStorage.getItem(LS_KEY) || DEFAULT_PROMPT_TEMPLATE)
    localWatchers.add(notify)
    notify()
    return () => localWatchers.delete(notify)
  }
  return onSnapshot(
    doc(db, 'settings', 'global'),
    (snap) => cb(snap.data()?.promptTemplate || DEFAULT_PROMPT_TEMPLATE),
    onError,
  )
}

export function savePromptTemplate(template) {
  if (!firebaseEnabled) {
    localStorage.setItem(LS_KEY, template)
    localWatchers.forEach((notify) => notify())
    return Promise.resolve()
  }
  return setDoc(doc(db, 'settings', 'global'), { promptTemplate: template }, { merge: true })
}
