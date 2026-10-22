'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from 'firebase/auth'
import { onValue, ref, set } from 'firebase/database'
import { getDb, getFirebaseAuth, initAnalytics, newGoogleProvider } from '../lib/firebase'
import { ADMIN_EMAILS, DEFAULT_MAINTENANCE, MAINTENANCE_PATH, normalizeMaintenance } from '../lib/config'
import { SERVERS, getServer, setServer } from '../lib/servers'
import { getLang, setLang } from '../lib/api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

const MAINT_CACHE = 'thy_maint_v1'
const DEFAULT_SETTINGS = { server: '', lang: 'sub' } // server '' = automatic (first working server)

const sanitize = (s) => ({
  server: s && SERVERS.some((x) => x.key === s.server) ? s.server : '',
  lang: s && s.lang === 'dub' ? 'dub' : 'sub',
})
const readLocal = () => sanitize({ server: getServer(), lang: getLang() })
const writeLocal = (s) => { setServer(s.server || ''); setLang(s.lang) }

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [maintenance, setMaintenance] = useState(normalizeMaintenance(DEFAULT_MAINTENANCE))
  const [maintenanceReady, setMaintenanceReady] = useState(false)
  const userRef = useRef(null)
  userRef.current = user

  // ── boot: local settings, cached maintenance flag, analytics, 1.5s cap on waiting for the database ──
  useEffect(() => {
    setSettings(readLocal())
    let cachedHit = false
    try {
      const raw = sessionStorage.getItem(MAINT_CACHE)
      if (raw) { setMaintenance(normalizeMaintenance(JSON.parse(raw))); cachedHit = true }
    } catch (e) {}
    if (cachedHit) setMaintenanceReady(true)
    initAnalytics()
    const t = setTimeout(() => setMaintenanceReady(true), 1500)
    return () => clearTimeout(t)
  }, [])

  // ── live maintenance flag from Realtime Database (config/maintenance) ──
  useEffect(() => {
    const db = getDb()
    if (!db) return
    const off = onValue(
      ref(db, MAINTENANCE_PATH),
      (snap) => {
        const v = snap.val()
        setMaintenance(normalizeMaintenance(v))
        setMaintenanceReady(true)
        try { sessionStorage.setItem(MAINT_CACHE, JSON.stringify(v === null ? false : v)) } catch (e) {}
      },
      () => setMaintenanceReady(true), // rules/network error → keep going with the defaults
    )
    return () => off()
  }, [])

  // ── auth state ──
  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) return
    return onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true) }, () => setAuthReady(true))
  }, [])

  // ── per-account settings sync: users/{uid}/settings ──
  useEffect(() => {
    const db = getDb()
    if (!user || !db) return
    const r = ref(db, 'users/' + user.uid + '/settings')
    let first = true
    const off = onValue(r, (snap) => {
      const remote = snap.val()
      if (remote) {
        const s = sanitize(remote)
        writeLocal(s)
        setSettings(s)
      } else if (first) {
        set(r, readLocal()).catch(() => {}) // brand-new account: upload what this browser already had
      }
      first = false
    }, () => {})
    return () => off()
  }, [user])

  const updateSettings = useCallback((patch) => {
    const next = sanitize({ ...readLocal(), ...patch })
    writeLocal(next)
    setSettings(next)
    const u = userRef.current
    const db = getDb()
    if (u && db) return set(ref(db, 'users/' + u.uid + '/settings'), next).then(() => true, () => false)
    return Promise.resolve(null) // null = saved on this device only
  }, [])

  const signIn = useCallback(async () => {
    setAuthError('')
    const auth = getFirebaseAuth()
    if (!auth) return
    try {
      await signInWithPopup(auth, newGoogleProvider())
    } catch (e) {
      const code = e && e.code
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      if (code === 'auth/popup-blocked') {
        try { await signInWithRedirect(auth, newGoogleProvider()); return } catch (e2) { e = e2 }
      }
      setAuthError(
        (e && e.code) === 'auth/unauthorized-domain'
          ? 'This domain isn’t authorised for sign-in yet (Firebase console → Authentication → Settings → Authorized domains).'
          : (e && e.code) === 'auth/operation-not-allowed'
          ? 'Google sign-in isn’t enabled yet (Firebase console → Authentication → Sign-in method → Google).'
          : 'Sign-in failed. ' + ((e && e.message) || ''),
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (auth) await fbSignOut(auth).catch(() => {})
  }, [])

  const isAdmin = !!(user && user.email && user.emailVerified !== false && ADMIN_EMAILS.includes(user.email.toLowerCase()))

  const value = useMemo(
    () => ({ user, authReady, authError, clearAuthError: () => setAuthError(''), signIn, signOut, isAdmin, settings, updateSettings, maintenance, maintenanceReady }),
    [user, authReady, authError, signIn, signOut, isAdmin, settings, updateSettings, maintenance, maintenanceReady],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
