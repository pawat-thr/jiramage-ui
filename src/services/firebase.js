import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Web config from .env (VITE_FIREBASE_*). These are not secrets — Firebase is
// secured by Auth + Security Rules, not by hiding this config.
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Disabled until a real apiKey is present (the .env placeholder contains
// "REPLACE"); while disabled the app runs open, with no login wall.
export const firebaseEnabled =
  Boolean(cfg.apiKey) && !String(cfg.apiKey).includes('REPLACE')

export const auth = firebaseEnabled ? getAuth(initializeApp(cfg)) : null
