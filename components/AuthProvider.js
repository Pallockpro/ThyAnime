'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from 'firebase/auth'
import { onValue, ref, set, update } from 'firebase/database'
import { getDb, getFirebaseAuth, initAnalytics, newGoogleProvider } from '../lib/firebase'
import { ADMIN_EMAILS, DEFAULT_MAINTENANCE, MAINTENANCE_PATH, normalizeMaintenance } from '../lib/config'
import { SERVERS, getServer, setServer } from '../lib/servers'
import { startPresence } from '../lib/presence'
import { getLang, setLang, getHistory, replaceHistory, clearLocalHistory, setHistoryHook, histKey } from '../lib/api'

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
  const wasSignedIn = useRef(false)
  const remoteKeys = useRef([])
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

  // ── presence: tell the server this tab is on the site (powers the live counter in Settings) ──
  useEffect(() => {
    const db = getDb()
    if (!db) return
    return startPresence(db)
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
    return onAuthStateChanged(auth, (u) => {
      // Signing out wipes the account's history from this browser so the next person on this device doesn't see it.
      if (!u && wasSignedIn.current) clearLocalHistory()
      wasSignedIn.current = !!u
      setUser(u)
      setAuthReady(true)
    }, () => setAuthReady(true))
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

  // ── per-account watch history sync: users/{uid}/history/{key} ──
  useEffect(() => {
    const db = getDb()
    if (!user || !db) return
    const base = ref(db, 'users/' + user.uid + '/history')
    let first = true

    // every local "watch" is mirrored to the account (and anything pushed out of the newest 20 is removed)
    setHistoryHook((entry, list) => {
      const patch = { [histKey(entry)]: entry }
      for (const k of remoteKeys.current) if (!list.some((x) => histKey(x) === k)) patch[k] = null
      update(base, patch).catch(() => {})
    })

    const off = onValue(base, (snap) => {
      const v = snap.val() || {}
      remoteKeys.current = Object.keys(v)
      const remote = Object.values(v)
      if (first) {
        // first load after signing in: merge what this browser already had (signed-out history) with the account's
        const byKey = new Map()
        for (const x of [...remote, ...getHistory()]) {
          const k = histKey(x), cur = byKey.get(k)
          if (!cur || (x.at || 0) > (cur.at || 0)) byKey.set(k, x)
        }
        const merged = replaceHistory([...byKey.values()])
        const patch = {}
        for (const x of merged) { const r = v[histKey(x)]; if (!r || (r.at || 0) < (x.at || 0)) patch[histKey(x)] = x }
        for (const k of Object.keys(v)) if (!merged.some((x) => histKey(x) === k)) patch[k] = null
        if (Object.keys(patch).length) update(base, patch).catch(() => {})
        first = false
      } else {
        replaceHistory(remote)
      }
    }, () => {})

    return () => { off(); setHistoryHook(null) }
  }, [user])

  const clearWatchHistory = useCallback(async () => {
    clearLocalHistory()
    const u = userRef.current
    const db = getDb()
    if (u && db) await set(ref(db, 'users/' + u.uid + '/history'), null).catch(() => {})
  }, [])

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
    () => ({ user, authReady, authError, clearAuthError: () => setAuthError(''), signIn, signOut, isAdmin, settings, updateSettings, clearWatchHistory, maintenance, maintenanceReady }),
    [user, authReady, authError, signIn, signOut, isAdmin, settings, updateSettings, clearWatchHistory, maintenance, maintenanceReady],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
