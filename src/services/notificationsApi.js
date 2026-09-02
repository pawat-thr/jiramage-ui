import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  updateDoc,
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

export function markAllRead(ids) {
  const batch = writeBatch(db)
  for (const id of ids) batch.update(notifDoc(id), { read: true })
  return batch.commit()
}

// One notification per recipient (self excluded), written in a single batch.
export function notifyReviewers({ prId, prTitle, from, toEmails }) {
  const targets = (toEmails || []).filter((e) => e && e !== from.email)
  if (!targets.length) return Promise.resolve()
  const batch = writeBatch(db)
  for (const toEmail of targets) {
    batch.set(doc(notifCol()), {
      type: 'pr_review_assigned',
      toEmail,
      fromEmail: from.email,
      fromName: from.name || from.email,
      refId: prId,
      title: prTitle,
      read: false,
      createdAt: serverTimestamp(),
    })
  }
  return batch.commit()
}
