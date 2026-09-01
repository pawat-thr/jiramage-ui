import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

const prCol = () => collection(db, 'prs')
const prDoc = (id) => doc(db, 'prs', id)
const commentsCol = (prId) => collection(db, 'prs', prId, 'comments')

// Real-time list of all PRs, newest first.
export function watchPRs(cb, onError) {
  return onSnapshot(
    query(prCol(), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export function createPR(data) {
  return addDoc(prCol(), {
    ...data,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updatePR(id, patch) {
  return updateDoc(prDoc(id), { ...patch, updatedAt: serverTimestamp() })
}

export function deletePR(id) {
  return deleteDoc(prDoc(id))
}

export function setStatus(id, status) {
  return updateDoc(prDoc(id), { status, updatedAt: serverTimestamp() })
}

export function watchComments(prId, cb, onError) {
  return onSnapshot(
    query(commentsCol(prId), orderBy('createdAt', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export function addComment(prId, comment) {
  return addDoc(commentsCol(prId), { ...comment, createdAt: serverTimestamp() })
}
