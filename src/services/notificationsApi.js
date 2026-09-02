import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

const notifCol = () => collection(db, 'notifications')
const notifDoc = (id) => doc(db, 'notifications', id)

// Live inbox for one user, newest first. No orderBy in the query (a where +
// orderBy combo would need a composite index) — we sort client-side instead.
export function watchInbox(toEmail, cb, onError) {
  return onSnapshot(
    query(notifCol(), where('toEmail', '==', toEmail)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      cb(items)
    },
    onError,
  )
}

export const markRead = (id) => updateDoc(notifDoc(id), { read: true })

export const deleteNotification = (id) => deleteDoc(notifDoc(id))

export function markAllRead(ids) {
  const batch = writeBatch(db)
  for (const id of ids) batch.update(notifDoc(id), { read: true })
  return batch.commit()
}

// One notification per recipient (self excluded), written in a single batch.
// type: 'pr_review_assigned' | 'pr_status_changed' | 'pr_comment'
// extra: type-specific fields (e.g. { statusLabel } for status changes).
export function sendNotifications({ type, toEmails, from, refId, title, extra = {} }) {
  const targets = (toEmails || []).filter((e) => e && e !== from.email)
  if (!targets.length) return Promise.resolve()
  const batch = writeBatch(db)
  for (const toEmail of targets) {
    batch.set(doc(notifCol()), {
      type,
      toEmail,
      fromEmail: from.email,
      fromName: from.name || from.email,
      refId,
      title,
      ...extra,
      read: false,
      createdAt: serverTimestamp(),
    })
  }
  return batch.commit()
}
