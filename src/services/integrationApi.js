import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

// Integration Plan rows live in Firestore (one doc per release+story) and are
// loaded on demand — no realtime listener by design.
const col = () => collection(db, 'integration')
const rowId = (release, key) => encodeURIComponent(`${release}|${key}`)

export async function fetchPlan(release) {
  const snap = await getDocs(query(col(), where('release', '==', release)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
}

// Sync against the release's current Jira stories:
//  - new in Jira      → add row (empty env/dates/remark)
//  - already stored   → keep the user's inputs (only refresh name/status)
//  - gone from Jira   → remove row
export async function syncPlan(release, jiraStories, existingRows) {
  // Firestore batches cap at 500 ops — collect ops, commit in chunks.
  const ops = []
  const jiraByKey = new Map(jiraStories.map((s) => [s.key, s]))
  const storedByKey = new Map(existingRows.map((r) => [r.key, r]))
  let added = 0
  let removed = 0

  for (const s of jiraStories) {
    const stored = storedByKey.get(s.key)
    if (!stored) {
      ops.push((b) => b.set(doc(col(), rowId(release, s.key)), {
        release,
        key: s.key,
        name: s.fields.summary,
        status: s.fields.status?.name || '',
        env: '',
        targetDates: {},
        remark: '',
        syncedAt: serverTimestamp(),
      }))
      added++
    } else if (stored.name !== s.fields.summary || stored.status !== (s.fields.status?.name || '')) {
      ops.push((b) =>
        b.update(doc(col(), stored.id), {
          name: s.fields.summary,
          status: s.fields.status?.name || '',
          syncedAt: serverTimestamp(),
        }),
      )
    }
  }
  for (const r of existingRows) {
    if (!jiraByKey.has(r.key)) {
      ops.push((b) => b.delete(doc(col(), r.id)))
      removed++
    }
  }
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 450)) op(batch)
    await batch.commit()
  }
  return { added, removed }
}

export function deletePlanRow(id) {
  return deleteDoc(doc(db, 'integration', id))
}

// Save many edited rows in one batch (the page's explicit Save button).
export async function savePlanRows(changes) {
  const batch = writeBatch(db)
  for (const c of changes) {
    batch.update(doc(db, 'integration', c.id), {
      env: c.env || '',
      targetDates: c.targetDates || {},
      remark: c.remark || '',
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}
