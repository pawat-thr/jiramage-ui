import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, firebaseEnabled } from './firebase.js'
import { CFG } from '../config/appConfig.js'

// Teamage (draft of PLAN-ORG-SSO Phase B). Teams + their leads come from env
// (TEAMS / TEAM_LEADS, parallel lists); MEMBERS live in Firestore under
// teams/{slug}/members/{email}. Login stays Firebase Auth (the whitelist) —
// membership only decides WHICH TEAM's data a signed-in user sees.
// No Firebase or empty TEAMS → feature off, env roster as always.

export const teamsEnabled = () => firebaseEnabled && (CFG.teams?.length || 0) > 0

// env mapping: the team this email LEADS, or null.
export function leadTeamOf(email) {
  const i = (CFG.teamLeads || []).indexOf(String(email || '').toLowerCase())
  return i >= 0 ? CFG.teams[i] || null : null
}

export const leadsOf = (team) =>
  (CFG.teams || []).flatMap((t, i) => (t === team && CFG.teamLeads[i] ? [CFG.teamLeads[i]] : []))

const memberDoc = (team, email) => doc(db, 'teams', team, 'members', String(email).toLowerCase())

// Which team is this user in? Leads resolve from env; members by their doc.
// Returns { team, role: 'lead'|'member', members: [emails] } or null (no team).
export async function resolveMembership(email) {
  const lower = String(email || '').toLowerCase()
  const lead = leadTeamOf(lower)
  if (lead) {
    // A lead's membership is pure env — NEVER blocked by Firestore. If the
    // member-list read fails (rules not published yet, offline), degrade to
    // just the leads and surface the problem instead of hiding it.
    try {
      return { team: lead, role: 'lead', members: await memberEmails(lead) }
    } catch (e) {
      return { team: lead, role: 'lead', members: leadsOf(lead), rosterError: e.message }
    }
  }
  for (const team of CFG.teams) {
    const snap = await getDoc(memberDoc(team, lower)) // throws on rules/permission problems
    if (snap.exists()) return { team, role: 'member', members: await memberEmails(team) }
  }
  return null
}

export async function memberEmails(team) {
  const snap = await getDocs(collection(db, 'teams', team, 'members'))
  const out = new Set(leadsOf(team)) // leads are implicit members
  snap.forEach((d) => out.add(d.id))
  return [...out]
}

// The data-scoping overlay: once membership is known, the team's member list
// BECOMES the roster (CFG.teamEmails) — every page (dashboards, Team Task,
// planner, pickers) shows THIS team with zero call-site changes.
export function applyTeamRoster(membership, selfEmail) {
  CFG.email = selfEmail || CFG.email
  CFG.teamEmails = membership.members
}

export const watchMembers = (team, cb, onError = () => {}) =>
  onSnapshot(
    collection(db, 'teams', team, 'members'),
    (snap) => {
      const rows = []
      snap.forEach((d) => rows.push({ email: d.id, ...d.data() }))
      rows.sort((a, b) => a.email.localeCompare(b.email))
      cb(rows)
    },
    onError,
  )

export function addMember(team, email, addedBy) {
  return setDoc(memberDoc(team, email), { addedBy, addedAt: serverTimestamp() })
}

export function removeMember(team, email) {
  return deleteDoc(memberDoc(team, email))
}
