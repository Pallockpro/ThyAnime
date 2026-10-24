'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from 'firebase/auth'
import { get, onValue, ref, set, update } from 'firebase/database'
import { getDb, getFirebaseAuth, googlePopupIdentity, initAnalytics, newGoogleProvider } from '../lib/firebase'
import { ADMIN_EMAILS, BANNER_PATH, DEFAULT_MAINTENANCE, MAINTENANCE_PATH, normalizeBanner, normalizeMaintenance } from '../lib/config'
import { SERVERS, getServer, setServer } from '../lib/servers'
import { startPresence } from '../lib/presence'
import { FAMILY_HINT, MAX_PROFILES, PROFILE_KEY, cleanName, cleanUsername, familyEmail, isFamilyEmail, newPid, usernameOf, validUsername } from '../lib/profiles'
import { SOURCE_KEYS, getSource, setSource, getLang, setLang, getHistory, replaceHistory, clearLocalHistory, setHistoryHook, histKey } from '../lib/api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

const MAINT_CACHE = 'thy_maint_v1'
const BANNER_CACHE = 'thy_banner_v1'
const DEFAULT_SETTINGS = { server: '', lang: 'sub', source: 'auto' } // server '' / source 'auto' = automatic

const sanitize = (s) => ({
  server: s && SERVERS.some((x) => x.key === s.server) ? s.server : '',
  lang: s && s.lang === 'dub' ? 'dub' : 'sub',
  source: s && SOURCE_KEYS.includes(s.source) ? s.source : 'auto',
})
const readLocal = () => sanitize({ server: getServer(), lang: getLang(), source: getSource() })
const writeLocal = (s) => { setServer(s.server || ''); setLang(s.lang); setSource(s.source) }

const authMsg = (e) => {
  const c = e && e.code
  if (c === 'auth/email-already-in-use') return 'That username is already taken — try another one.'
  if (c === 'auth/weak-password') return 'Password must be at least 6 characters.'
  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(c)) return 'Wrong username or password.'
  if (c === 'auth/too-many-requests') return 'Too many attempts — wait a minute and try again.'
  if (c === 'auth/network-request-failed') return 'Network error — check your connection and try again.'
  if (c === 'auth/operation-not-allowed') return 'Username sign-in isn’t switched on yet (Firebase console → Authentication → Sign-in method → Email/Password → Enable).'
  if (c === 'auth/unauthorized-domain') return 'This domain isn’t authorised for sign-in yet (Firebase console → Authentication → Settings → Authorized domains).'
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return ''
  if (c === 'auth/popup-blocked') return 'Your browser blocked the Google pop-up — allow pop-ups for this site and try again.'
  if (c === 'PERMISSION_DENIED' || /permission_denied/i.test((e && e.message) || '')) return 'The database refused that (rules not updated yet? see firebase/README.md).'
  return 'Something went wrong. ' + ((e && e.message) || '')
}
const readSession = (k) => { try { return sessionStorage.getItem(k) } catch (e) { return null } }
const writeSession = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v) } catch (e) {} }
const clearAllProfileKeys = () => { try { Object.keys(sessionStorage).filter((k) => k.startsWith(PROFILE_KEY)).forEach((k) => sessionStorage.removeItem(k)) } catch (e) {} }

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [maintenance, setMaintenance] = useState(normalizeMaintenance(DEFAULT_MAINTENANCE))
  const [maintenanceReady, setMaintenanceReady] = useState(false)
  const [banner, setBanner] = useState({ visible: false, rotations: false, items: [], text: '' })
  const [famHint, setFamHint] = useState(false)
  const [linkRes, setLinkRes] = useState({ uid: null, v: null })           // Gmail → profile link (or null) for the signed-in Google user
  const [profilesRes, setProfilesRes] = useState({ uid: null, v: {}, err: false }) // family: every profile
  const [pidRes, setPidRes] = useState({ uid: null, id: null })            // family: the profile this session picked
  const [memberRes, setMemberRes] = useState({ key: '', v: null })         // linked Google user: their profile
  const [nickRes, setNickRes] = useState({ uid: null, v: '' })             // plain Google user: custom display name
  const [manageOnOpen, setManageOnOpen] = useState(false)
  const userRef = useRef(null)
  const baseRef = useRef(null)
  const wasSignedIn = useRef(false)
  const remoteKeys = useRef([])
  userRef.current = user

  // ── boot: local settings, cached maintenance flag, analytics, 1.5s cap on waiting for the database ──
  useEffect(() => {
    setSettings(readLocal())
    try { setFamHint(localStorage.getItem(FAMILY_HINT) === '1') } catch (e) {}
    let cachedHit = false
    try {
      const raw = sessionStorage.getItem(MAINT_CACHE)
      if (raw) { setMaintenance(normalizeMaintenance(JSON.parse(raw))); cachedHit = true }
    } catch (e) {}
    if (cachedHit) setMaintenanceReady(true)
    try {
      const rawB = sessionStorage.getItem(BANNER_CACHE)
      if (rawB) setBanner(normalizeBanner(JSON.parse(rawB))) // avoids the banner popping in and shoving the page down on every navigation
    } catch (e) {}
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

  // ── live site banner from Realtime Database (config/banner: Text, Text2…, Visible, rotations) ──
  useEffect(() => {
    const db = getDb()
    if (!db) return
    const off = onValue(
      ref(db, BANNER_PATH),
      (snap) => {
        const v = snap.val()
        setBanner(normalizeBanner(v))
        try { sessionStorage.setItem(BANNER_CACHE, JSON.stringify(v === null ? {} : v)) } catch (e) {}
      },
      () => {}, // rules/network error → no banner
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

  // ── who is this? ──
  const uid = user ? user.uid : null
  const isFamily = !!user && isFamilyEmail(user.email)

  // a Google user might be a family member (their Gmail was linked to a profile) → look it up once per sign-in
  useEffect(() => {
    const db = getDb()
    if (!uid || !db || isFamily) return
    let dead = false
    get(ref(db, 'googleLinks/' + uid))
      .then((snap) => { if (!dead) { const v = snap.val(); setLinkRes({ uid, v: v && v.fam && v.pid ? { fam: v.fam, pid: v.pid } : null }) } })
      .catch(() => { if (!dead) setLinkRes({ uid, v: null }) })
    return () => { dead = true }
  }, [uid, isFamily])
  const link = !user || isFamily ? null : linkRes.uid === uid ? linkRes.v : undefined // undefined = still checking

  // family account: live list of its profiles + which one this browser session picked
  useEffect(() => {
    const db = getDb()
    if (!uid || !db || !isFamily) return
    const off = onValue(
      ref(db, 'families/' + uid + '/profiles'),
      (snap) => setProfilesRes({ uid, v: snap.val() || {}, err: false }),
      () => setProfilesRes({ uid, v: {}, err: true }),
    )
    return () => off()
  }, [uid, isFamily])
  useEffect(() => {
    if (!uid || !isFamily) return
    setPidRes({ uid, id: readSession(PROFILE_KEY + uid) })
    try { localStorage.setItem(FAMILY_HINT, '1') } catch (e) {}
  }, [uid, isFamily])
  useEffect(() => {
    if (authReady && !isFamily) { try { localStorage.removeItem(FAMILY_HINT) } catch (e) {} }
  }, [authReady, isFamily])

  const profiles = isFamily && profilesRes.uid === uid
    ? Object.entries(profilesRes.v).map(([id, p]) => ({ id, ...p })).sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0))
    : null
  const profilesError = isFamily && profilesRes.uid === uid && profilesRes.err
  const pidReady = isFamily && pidRes.uid === uid
  const activeProfile = profiles && pidReady ? profiles.find((p) => p.id === pidRes.id) || null : null
  const needsProfile = isFamily && pidReady && profiles !== null && !activeProfile
  const profileLoading = isFamily && (!pidReady || profiles === null)

  // linked Google user: their profile card (name / avatar) — live
  const memberKey = link ? link.fam + '/' + link.pid : ''
  useEffect(() => {
    const db = getDb()
    if (!memberKey || !db) return
    const off = onValue(
      ref(db, 'families/' + memberKey.split('/')[0] + '/profiles/' + memberKey.split('/')[1]),
      (snap) => setMemberRes({ key: memberKey, v: snap.val() }),
      () => setMemberRes({ key: memberKey, v: null }),
    )
    return () => off()
  }, [memberKey])
  const memberProfile = link && memberRes.key === memberKey && memberRes.v ? { id: link.pid, ...memberRes.v } : null

  // plain Google user: optional custom display name
  useEffect(() => {
    const db = getDb()
    if (!uid || !db || isFamily || link !== null) return
    const off = onValue(ref(db, 'users/' + uid + '/name'), (snap) => setNickRes({ uid, v: snap.val() || '' }), () => {})
    return () => off()
  }, [uid, isFamily, link])
  const nick = nickRes.uid === uid ? nickRes.v : ''

  // where this person's settings + history live
  const base = !user ? null
    : isFamily ? (activeProfile ? 'families/' + uid + '/profiles/' + activeProfile.id : null)
    : link === undefined ? null
    : link ? 'families/' + link.fam + '/profiles/' + link.pid
    : 'users/' + uid
  baseRef.current = base

  // ── per-account (or per-profile) settings sync: {base}/settings ──
  useEffect(() => {
    const db = getDb()
    if (!base || !db) return
    const r = ref(db, base + '/settings')
    let first = true
    const off = onValue(r, (snap) => {
      const remote = snap.val()
      if (remote) {
        const s = sanitize({ ...readLocal(), ...remote }) // older accounts have no `source` yet → keep this browser's choice
        writeLocal(s)
        setSettings(s)
      } else if (first) {
        set(r, readLocal()).catch(() => {}) // brand-new account / profile: upload what this browser already had
      }
      first = false
    }, () => {})
    return () => off()
  }, [base])

  // ── per-account (or per-profile) watch history sync: {base}/history/{key} ──
  useEffect(() => {
    const db = getDb()
    if (!base || !db) return
    const hbase = ref(db, base + '/history')
    let first = true
    remoteKeys.current = []

    // every local "watch" is mirrored to the account (and anything pushed out of the newest 20 is removed)
    setHistoryHook((entry, list) => {
      const patch = { [histKey(entry)]: entry }
      for (const k of remoteKeys.current) if (!list.some((x) => histKey(x) === k)) patch[k] = null
      update(hbase, patch).catch(() => {})
    })

    const off = onValue(hbase, (snap) => {
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
        if (Object.keys(patch).length) update(hbase, patch).catch(() => {})
        first = false
      } else {
        replaceHistory(remote)
      }
    }, () => {})

    return () => { off(); setHistoryHook(null) }
  }, [base])

  const clearWatchHistory = useCallback(async () => {
    clearLocalHistory()
    const b = baseRef.current
    const db = getDb()
    if (b && db) await set(ref(db, b + '/history'), null).catch(() => {})
  }, [])

  const updateSettings = useCallback((patch) => {
    const next = sanitize({ ...readLocal(), ...patch })
    writeLocal(next)
    setSettings(next)
    const b = baseRef.current
    const db = getDb()
    if (b && db) return set(ref(db, b + '/settings'), next).then(() => true, () => false)
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
    clearAllProfileKeys()
    try { localStorage.removeItem(FAMILY_HINT) } catch (e) {}
    setFamHint(false)
    const auth = getFirebaseAuth()
    if (auth) await fbSignOut(auth).catch(() => {})
  }, [])

  // ── family accounts ──
  const signInFamily = useCallback(async (username, password) => {
    const auth = getFirebaseAuth()
    if (!auth) return { ok: false, error: 'Not ready yet — try again.' }
    const u = cleanUsername(username)
    if (!u || !password) return { ok: false, error: 'Enter your family username and password.' }
    try { await signInWithEmailAndPassword(auth, familyEmail(u), password); return { ok: true } }
    catch (e) { return { ok: false, error: authMsg(e) } }
  }, [])

  const signUpFamily = useCallback(async ({ username, password, profileName }) => {
    const auth = getFirebaseAuth(), db = getDb()
    if (!auth || !db) return { ok: false, error: 'Not ready yet — try again.' }
    const u = cleanUsername(username)
    if (!validUsername(u)) return { ok: false, error: 'Username must be 3–20 characters: letters, numbers, dot, dash or underscore.' }
    const name = cleanName(profileName) || 'Me'
    let cred
    try { cred = await createUserWithEmailAndPassword(auth, familyEmail(u), password) }
    catch (e) { return { ok: false, error: authMsg(e) } }
    const id = newPid()
    writeSession(PROFILE_KEY + cred.user.uid, id) // the first profile is picked automatically
    setPidRes({ uid: cred.user.uid, id })
    try {
      await set(ref(db, 'families/' + cred.user.uid + '/profiles/' + id), { name, avatar: '0', createdAt: Date.now(), primary: true })
    } catch (e) {
      return { ok: true, warning: 'Account created, but saving your profile failed: ' + authMsg(e) }
    }
    return { ok: true }
  }, [])

  const selectProfile = useCallback((id) => {
    const u = userRef.current
    if (!u) return
    clearLocalHistory() // never let the previous person's local "continue watching" leak into this profile
    writeSession(PROFILE_KEY + u.uid, id)
    setPidRes({ uid: u.uid, id })
  }, [])

  const switchProfile = useCallback((opts) => {
    const u = userRef.current
    if (!u) return
    clearLocalHistory()
    writeSession(PROFILE_KEY + u.uid, null)
    setManageOnOpen(!!(opts && opts.manage))
    setPidRes({ uid: u.uid, id: null })
  }, [])

  const addProfile = useCallback(async ({ name, avatar }) => {
    const u = userRef.current, db = getDb()
    if (!u || !db) return { ok: false, error: 'Not signed in.' }
    const n = cleanName(name)
    if (!n) return { ok: false, error: 'Give the profile a name.' }
    const id = newPid()
    try { await set(ref(db, 'families/' + u.uid + '/profiles/' + id), { name: n, avatar: String(avatar || '0'), createdAt: Date.now() }); return { ok: true, id } }
    catch (e) { return { ok: false, error: authMsg(e) } }
  }, [])

  /** Rename / change avatar of any profile (family owner), */
  const saveProfile = useCallback(async (id, { name, avatar }) => {
    const u = userRef.current, db = getDb()
    if (!u || !db) return { ok: false, error: 'Not signed in.' }
    const n = cleanName(name)
    if (!n) return { ok: false, error: 'Name can’t be empty.' }
    const fam = isFamilyEmail(u.email) ? u.uid : null
    if (!fam) return { ok: false, error: 'Not allowed.' }
    try { await update(ref(db, 'families/' + fam + '/profiles/' + id), { name: n, avatar: String(avatar || '0') }); return { ok: true } }
    catch (e) { return { ok: false, error: authMsg(e) } }
  }, [])

  const deleteProfile = useCallback(async (id, googleUid) => {
    const u = userRef.current, db = getDb()
    if (!u || !db) return { ok: false, error: 'Not signed in.' }
    const patch = { ['families/' + u.uid + '/profiles/' + id]: null }
    if (googleUid) patch['googleLinks/' + googleUid] = null
    try { await update(ref(db), patch); return { ok: true } }
    catch (e) { return { ok: false, error: authMsg(e) } }
  }, [])

  /** Family owner: pick a Google account in a pop-up and attach it to a profile. */
  const linkGoogle = useCallback(async (id, existing) => {
    const u = userRef.current, db = getDb()
    if (!u || !db) return { ok: false, error: 'Not signed in.' }
    let who
    try { who = await googlePopupIdentity() }
    catch (e) { return { ok: false, error: authMsg(e) } }
    if (!who || !who.uid) return { ok: false, error: '' }
    const taken = (existing || []).find((p) => p.google && p.google.uid === who.uid && p.id !== id)
    if (taken) return { ok: false, error: who.email + ' is already linked to “' + taken.name + '”. Unlink it there first.' }
    const patch = {
      ['families/' + u.uid + '/profiles/' + id + '/google']: { uid: who.uid, email: who.email, name: who.name.slice(0, 60), photo: who.photo.slice(0, 500) },
      ['googleLinks/' + who.uid]: { fam: u.uid, pid: id },
    }
    // if this profile already had a different Gmail, free that one
    const prev = (existing || []).find((p) => p.id === id)
    if (prev && prev.google && prev.google.uid !== who.uid) patch['googleLinks/' + prev.google.uid] = null
    try { await update(ref(db), patch); return { ok: true, email: who.email } }
    catch (e) { return { ok: false, error: /permission/i.test((e && e.message) || '') ? 'That Google account is already linked to another family (or the database rules aren’t updated yet).' : authMsg(e) } }
  }, [])

  const unlinkGoogle = useCallback(async (id, googleUid) => {
    const u = userRef.current, db = getDb()
    if (!u || !db) return { ok: false, error: 'Not signed in.' }
    const patch = { ['families/' + u.uid + '/profiles/' + id + '/google']: null }
    if (googleUid) patch['googleLinks/' + googleUid] = null
    try { await update(ref(db), patch); return { ok: true } }
    catch (e) { return { ok: false, error: authMsg(e) } }
  }, [])

  /** Rename yourself: family profile you're using, your linked profile, or a plain Google account. */
  const saveMyProfile = useCallback(async ({ name, avatar }) => {
    const u = userRef.current, db = getDb()
    if (!u || !db) return { ok: false, error: 'Not signed in.' }
    const n = cleanName(name)
    if (!n) return { ok: false, error: 'Name can’t be empty.' }
    try {
      if (isFamilyEmail(u.email)) {
        const pid = readSession(PROFILE_KEY + u.uid)
        if (!pid) return { ok: false, error: 'Pick a profile first.' }
        await update(ref(db, 'families/' + u.uid + '/profiles/' + pid), { name: n, avatar: String(avatar || '0') })
      } else if (linkRef.current) {
        await update(ref(db, 'families/' + linkRef.current.fam + '/profiles/' + linkRef.current.pid), { name: n, avatar: String(avatar || '0') })
      } else {
        await set(ref(db, 'users/' + u.uid + '/name'), n)
      }
      return { ok: true }
    } catch (e) { return { ok: false, error: authMsg(e) } }
  }, [])
  const linkRef = useRef(null)
  linkRef.current = link || null

  const isAdmin = !!(user && user.email && user.emailVerified !== false && ADMIN_EMAILS.includes(user.email.toLowerCase()))

  // one tidy description of "who is using the site right now"
  const me = !user ? null
    : isFamily ? (activeProfile ? { name: activeProfile.name, avatar: activeProfile.avatar, photo: '', kind: 'family', sub: '@' + usernameOf(user.email), id: activeProfile.id } : { name: 'Family', avatar: '0', photo: '', kind: 'family', sub: '@' + usernameOf(user.email), id: '' })
    : link ? { name: (memberProfile && memberProfile.name) || user.displayName || 'ThyAnime user', avatar: memberProfile ? memberProfile.avatar : null, photo: user.photoURL || '', kind: 'member', sub: user.email || '', id: link.pid }
    : { name: nick || user.displayName || 'ThyAnime user', avatar: null, photo: user.photoURL || '', kind: 'google', sub: user.email || '', id: '' }

  const value = {
    user, me, authReady, authError, clearAuthError: () => setAuthError(''), signIn, signOut, isAdmin, settings, updateSettings, clearWatchHistory,
    maintenance, maintenanceReady, banner,
    // family accounts / profiles
    isFamily, profiles, profilesError, activeProfile, needsProfile, profileLoading, famHint, manageOnOpen, maxProfiles: MAX_PROFILES,
    signInFamily, signUpFamily, selectProfile, switchProfile, addProfile, saveProfile, deleteProfile, linkGoogle, unlinkGoogle, saveMyProfile,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
