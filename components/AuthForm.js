'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Users } from 'lucide-react'
import { useAuth } from './AuthProvider'
import Logo from './Logo'
import { MAX_PROFILES, NAME_MAX, cleanUsername, validUsername } from '../lib/profiles'

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 7.2-9.6 7.2-16.9z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

const input = 'glass w-full rounded-xl px-4 py-3 text-sm outline-none transition placeholder:text-zinc-500 focus:ring-1 focus:ring-blossom-500'

/** Shared by /login and /signup. mode = 'login' | 'signup' */
export default function AuthForm({ mode }) {
  const router = useRouter()
  const { user, authReady, needsProfile, profileLoading, signIn, signInFamily, signUpFamily, authError, clearAuthError } = useAuth()
  const signup = mode === 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [profileName, setProfileName] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  // signed in (and, for family accounts, a profile is picked) → go home
  useEffect(() => {
    if (authReady && user && !needsProfile && !profileLoading) router.replace('/')
  }, [authReady, user, needsProfile, profileLoading, router])
  useEffect(() => () => clearAuthError(), [clearAuthError])

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError(''); setNote(''); clearAuthError()
    const u = cleanUsername(username)
    if (signup) {
      if (!validUsername(u)) return setError('Username must be 3–20 characters: letters, numbers, dot, dash or underscore.')
      if (password.length < 6) return setError('Password must be at least 6 characters.')
      if (password !== confirm) return setError('The two passwords don’t match.')
    }
    setBusy(true)
    const r = signup ? await signUpFamily({ username: u, password, profileName }) : await signInFamily(u, password)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    if (r.warning) setNote(r.warning)
  }

  const tab = (on) => 'flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition ' + (on ? 'bg-blossom-500 text-white' : 'text-zinc-400 hover:text-white')

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 pb-16 pt-28">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6 sm:p-8">
        <p className="mb-5 flex items-center justify-center gap-2 text-lg font-extrabold tracking-tight"><Logo size={26} /><span className="text-grad">ThyAnime</span></p>

        <div className="glass mb-6 flex rounded-full p-1">
          <Link href="/login/" className={tab(!signup)}>Sign in</Link>
          <Link href="/signup/" className={tab(signup)}>Create account</Link>
        </div>

        <button type="button" onClick={signIn} className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:scale-[1.02]">
          <GoogleG /> Continue with Google
        </button>
        <p className="mt-2 text-center text-xs text-zinc-500">{signup ? 'A personal account — your history and settings follow you on every device.' : 'Personal accounts, or a Gmail that was added to a family profile.'}</p>
        {authError ? <p className="mt-3 text-center text-sm text-amber-300/90">{authError}</p> : null}

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-zinc-600">
          <span className="h-px flex-1 bg-white/10" />{signup ? 'or make a family account' : 'or family account'}<span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl bg-white/5 p-3 text-xs leading-relaxed text-zinc-400">
            <Users size={18} className="mt-0.5 shrink-0 text-blossom-400" />
            <span>{signup
              ? <>One shared login with up to <b className="text-zinc-200">{MAX_PROFILES} profiles</b> — everyone gets their own watch history and settings. No email or Gmail needed.</>
              : <>Enter your family username and password, then pick who’s watching.</>}</span>
          </div>

          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Family username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} className={input} aria-label="Family username" />
          <div className="relative">
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? 'text' : 'password'} placeholder="Password" autoComplete={signup ? 'new-password' : 'current-password'} className={input + ' pr-12'} aria-label="Password" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-400 transition hover:text-white">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {signup ? (
            <>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={show ? 'text' : 'password'} placeholder="Confirm password" autoComplete="new-password" className={input} aria-label="Confirm password" />
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your profile name (e.g. Dad)" maxLength={NAME_MAX} autoComplete="off" className={input} aria-label="Your profile name" />
              <p className="px-1 text-xs text-zinc-500">You’ll add the other profiles — and link their Gmail accounts — after signing in. There’s no email on a family account, so write the password down: it can’t be reset.</p>
            </>
          ) : null}

          {error ? <p className="text-sm text-amber-300/90">{error}</p> : null}
          {note ? <p className="text-sm text-amber-300/90">{note}</p> : null}

          <button type="submit" disabled={busy} className="w-full rounded-full bg-blossom-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blossom-400 disabled:opacity-60">
            {busy ? (signup ? 'Creating…' : 'Signing in…') : signup ? 'Create family account' : 'Sign in to family'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
