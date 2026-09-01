import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { auth } from './firebase.js'
import { CFG } from '../config/appConfig.js'
import { emailUsername } from '../utils/format.js'

// The allowlist = your own email + TEAM_EMAILS from .env. Only these may sign in.
const allowlist = [CFG.email, ...CFG.teamEmails]
  .map((e) => (e || '').trim().toLowerCase())
  .filter(Boolean)

export const isAllowed = (email) => allowlist.includes((email || '').trim().toLowerCase())

function friendly(err) {
  const code = err?.code || ''
  if (code.includes('operation-not-allowed') || code.includes('configuration-not-found'))
    return 'Email/Password sign-in is not enabled. In the Firebase console, open Authentication → Sign-in method and enable Email/Password.'
  if (
    code.includes('invalid-credential') ||
    code.includes('wrong-password') ||
    code.includes('user-not-found')
  )
    return 'Wrong email or password.'
  if (code.includes('email-already-in-use'))
    return 'This account already exists — use “Sign in” instead.'
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.'
  if (code.includes('invalid-email')) return 'That is not a valid email address.'
  if (code.includes('too-many-requests')) return 'Too many attempts — please wait and try again.'
  return err?.message || String(err)
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb)
}

// Normal sign-in for an already-activated account.
export async function signIn(email, password) {
  if (!isAllowed(email)) throw new Error('This email is not on the team allowlist.')
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  } catch (e) {
    throw new Error(friendly(e))
  }
}

// First login: create the account and set the chosen password.
export async function activate(email, password) {
  if (!isAllowed(email)) throw new Error('This email is not on the team allowlist.')
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(cred.user, { displayName: emailUsername(email) })
  } catch (e) {
    throw new Error(friendly(e))
  }
}

export async function logout() {
  await signOut(auth)
}

// Change password from Settings — requires the current password (reauth).
export async function changePassword(currentPassword, newPassword) {
  const user = auth?.currentUser
  if (!user) throw new Error('You are not signed in.')
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, cred)
    await updatePassword(user, newPassword)
  } catch (e) {
    throw new Error(friendly(e))
  }
}
