// Firebase (client only). Everything is created lazily in the browser so the static export/prerender never touches it.
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Web config is public by design (security comes from Auth + Database rules, not from hiding this).
const firebaseConfig = {
  apiKey: 'AIzaSyD52O34Gz6c_ZSTQUqJVgT53UYH-ON4-dI',
  authDomain: 'thyanime-88d67.firebaseapp.com',
  databaseURL: 'https://thyanime-88d67-default-rtdb.firebaseio.com',
  projectId: 'thyanime-88d67',
  storageBucket: 'thyanime-88d67.firebasestorage.app',
  messagingSenderId: '995132285529',
  appId: '1:995132285529:web:31e95c254109db50b38748',
  measurementId: 'G-4HLEGJYE22',
}

const inBrowser = () => typeof window !== 'undefined'

export function getFirebaseApp() {
  if (!inBrowser()) return null
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}
export function getFirebaseAuth() {
  const app = getFirebaseApp()
  return app ? getAuth(app) : null
}
export function getDb() {
  const app = getFirebaseApp()
  return app ? getDatabase(app) : null
}
export function newGoogleProvider() {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}
/** Analytics only works in some browsers (not with blockers / some privacy modes) — never let it break the site. */
export async function initAnalytics() {
  try {
    const app = getFirebaseApp()
    if (!app) return
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    if (await isSupported()) getAnalytics(app)
  } catch (e) {}
}
