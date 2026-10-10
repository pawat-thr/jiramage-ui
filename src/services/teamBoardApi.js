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
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { teamStamp, inActiveTeam } from './teamsApi.js'

// ---- labels ----
export function watchLabels(cb, onError) {
  return onSnapshot(
    query(collection(db, 'labels'), orderBy('name', 'asc')),
    (snap) => cb(snap.docs.filter((d) => inActiveTeam(d.data())).map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export function createLabel(data) {
  return addDoc(collection(db, 'labels'), { ...data, ...teamStamp(), createdAt: serverTimestamp() })
}

// Rename a label AND retag every task using it, atomically (one batch).
export function renameLabel(labelId, newName, taskIds) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'labels', labelId), { name: newName })
  for (const id of taskIds) {
    batch.update(doc(db, 'tasks', id), { label: newName, updatedAt: serverTimestamp() })
  }
  return batch.commit()
}

// Delete a label (caller must ensure no tasks still use it).
export function deleteLabel(labelId) {
  return deleteDoc(doc(db, 'labels', labelId))
}

// ---- tasks ----
export function watchTasks(cb, onError) {
  return onSnapshot(
    query(collection(db, 'tasks'), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.filter((d) => inActiveTeam(d.data())).map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export function createTask(data) {
  return addDoc(collection(db, 'tasks'), {
    ...data,
    ...teamStamp(),
    status: 'todo',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateTask(id, patch) {
  return updateDoc(doc(db, 'tasks', id), { ...patch, updatedAt: serverTimestamp() })
}

export function deleteTask(id) {
  return deleteDoc(doc(db, 'tasks', id))
}

export function setTaskStatus(id, status) {
  return updateDoc(doc(db, 'tasks', id), { status, updatedAt: serverTimestamp() })
}
