import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

// QA Capacity Planner persistence: ONE Firestore doc per QA user per month —
// collection `qaPlan`, id `<email>|<YYYY-MM>`:
//   { capacity: { 'YYYY-MM-DD': n }, days: { 'YYYY-MM-DD': [ {key, points, delayed?} ] } }
// Loaded on open, whole-doc saved on change (11 users → 11 small docs/month).

const planDoc = (email, mKey) => doc(db, 'qaPlan', encodeURIComponent(`${email}|${mKey}`))

export async function loadPlans(emails, mKey) {
  const out = {}
  for (let i = 0; i < emails.length; i += 5) {
    await Promise.all(
      emails.slice(i, i + 5).map(async (email) => {
        const snap = await getDoc(planDoc(email, mKey))
        const data = snap.exists() ? snap.data() : {}
        out[email] = { capacity: data.capacity || {}, days: data.days || {} }
      }),
    )
  }
  return out
}

export function savePlan(email, mKey, plan) {
  return setDoc(planDoc(email, mKey), {
    capacity: plan.capacity || {},
    days: plan.days || {},
    updatedAt: serverTimestamp(),
  })
}
