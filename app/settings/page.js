'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, LogOut, Server, Languages, User, History, Users, Database } from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'
import { SERVERS, probe } from '../../lib/servers'
import { SOURCES } from '../../lib/api'
import { yume } from '../../lib/yumelist'
import { getDb } from '../../lib/firebase'
import { watchOnlineCount } from '../../lib/presence'

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
)

function Section({ icon: Icon, title, hint, children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon size={18} className="text-blossom-400" /> {title}</h2>
      {hint ? <p className="mt-1 text-sm text-zinc-400">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </motion.section>
  )
}

export default function SettingsPage() {
  const { user, authReady, signIn, signOut, authError, settings, updateSettings, clearWatchHistory } = useAuth()
  const [online, setOnline] = useState(null) // null = connecting, -1 = unavailable
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [up, setUp] = useState({})
  const [status, setStatus] = useState('') // '' | 'device' | 'synced' | 'failed'

  useEffect(() => { document.title = 'Settings — ThyAnime' }, [])
  useEffect(() => {
    const db = getDb()
    if (!db) return
    return watchOnlineCount(db, setOnline, () => setOnline(-1))
  }, [])
  useEffect(() => {
    SERVERS.filter((s) => s.probe).forEach((s) => probe(s.probe).then((ok) => setUp((u) => ({ ...u, [s.key]: ok }))))
  }, [])
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(''), 2500)
    return () => clearTimeout(t)
  }, [status])

  const save = async (patch) => {
    const r = await updateSettings(patch)
    setStatus(r === null ? 'device' : r ? 'synced' : 'failed')
  }

  const options = [{ key: '', name: 'Automatic', note: 'Use the first server that works for each anime.' }, ...SERVERS.map((s) => ({ key: s.key, name: s.name, note: s.own ? 'Your own ThyAnime server' : 'Third-party player', down: up[s.key] === false }))]

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-24 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold"><span className="text-grad">Settings</span></h1>
        <span className={'flex items-center gap-1.5 text-sm transition-opacity ' + (status ? 'opacity-100' : 'opacity-0') + (status === 'failed' ? ' text-amber-300' : ' text-emerald-300')}>
          <Check size={15} />
          {status === 'synced' ? 'Saved to your account' : status === 'failed' ? 'Saved here, but account sync failed' : 'Saved on this device'}
        </span>
      </div>

      <div className="space-y-5">
        <Section icon={User} title="Account" hint="Sign in with Google to keep your settings on every device.">
          {!authReady ? (
            <div className="shimmer h-12 rounded-xl" />
          ) : user ? (
            <div className="flex flex-wrap items-center gap-4">
              {user.photoURL
                ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full ring-2 ring-blossom-500/60" />
                : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blossom-500 text-lg font-bold">{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{user.displayName || 'ThyAnime user'}</p>
                <p className="truncate text-sm text-zinc-400">{user.email}</p>
              </div>
              <button onClick={signOut} className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm transition hover:bg-white/15"><LogOut size={15} /> Sign out</button>
            </div>
          ) : (
            <div>
              <button onClick={signIn} className="flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition hover:scale-[1.03]">
                <GoogleG /> Continue with Google
              </button>
              {authError ? <p className="mt-3 text-sm text-amber-300/90">{authError}</p> : null}
            </div>
          )}
        </Section>

        <Section icon={Server} title="Default server" hint="The player starts on this server. If it can’t play a title, the next working one is used instead.">
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => {
              const on = settings.server === o.key
              return (
                <button key={o.key || 'auto'} onClick={() => save({ server: o.key })} disabled={o.down}
                  className={'flex items-start gap-3 rounded-xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ' + (on ? 'bg-blossom-500/20 ring-1 ring-blossom-500/70' : 'glass hover:bg-white/10')}>
                  <span className={'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ' + (on ? 'border-blossom-400 bg-blossom-500' : 'border-zinc-600')}>
                    {on ? <Check size={12} strokeWidth={4} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{o.name}{o.down ? ' · offline' : ''}</span>
                    <span className="block text-xs text-zinc-400">{o.note}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-500">Switching servers from the player only lasts for that viewing session — this setting is your permanent default.</p>
        </Section>


        <Section icon={Database} title="Data source" hint="Where anime info (posters, details, episode lists) comes from. Automatic uses them in order and is recommended.">
          <div className="grid gap-2 sm:grid-cols-2">
            {SOURCES.map((o) => {
              const off = o.needsSetup && !yume.enabled
              const on = settings.source === o.key
              return (
                <button key={o.key} onClick={() => save({ source: o.key })} disabled={off}
                  className={'flex items-start gap-3 rounded-xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ' + (on ? 'bg-blossom-500/20 ring-1 ring-blossom-500/70' : 'glass hover:bg-white/10')}>
                  <span className={'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ' + (on ? 'border-blossom-400 bg-blossom-500' : 'border-zinc-600')}>
                    {on ? <Check size={12} strokeWidth={4} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{o.name}{o.key === 'auto' ? ' · default' : ''}{off ? ' · not set up' : ''}</span>
                    <span className="block text-xs text-zinc-400">{o.note}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-500">If your chosen source is down, the others are tried automatically so the site never goes blank. Applies the next time a page loads.</p>
        </Section>

        <Section icon={Languages} title="Default audio" hint="Used when you press Watch from a poster or the Hero banner.">
          <div className="glass relative inline-flex rounded-full p-1">
            {[['sub', 'Subbed'], ['dub', 'Dubbed']].map(([k, label]) => (
              <button key={k} onClick={() => save({ lang: k })} className={'relative rounded-full px-6 py-2 text-sm font-semibold transition ' + (settings.lang === k ? 'text-white' : 'text-zinc-400')}>
                {settings.lang === k ? <motion.span layoutId="setlang" className="absolute inset-0 rounded-full bg-blossom-500" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section icon={History} title="Watch history" hint={user ? 'Your “Continue watching” list is saved to your account and follows you to any device.' : 'Your “Continue watching” list is saved on this device only. Sign in to keep it on your account.'}>
          {cleared ? (
            <p className="text-sm text-emerald-300">History cleared.</p>
          ) : confirmClear ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-zinc-300">{user ? 'Delete your history from this device and your account?' : 'Delete your history from this device?'}</span>
              <button onClick={async () => { await clearWatchHistory(); setConfirmClear(false); setCleared(true); setTimeout(() => setCleared(false), 2500) }} className="rounded-full bg-blossom-500 px-4 py-2 font-semibold transition hover:scale-105">Delete</button>
              <button onClick={() => setConfirmClear(false)} className="glass rounded-full px-4 py-2 transition hover:bg-white/15">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="glass rounded-full px-4 py-2 text-sm transition hover:bg-white/15">Clear watch history</button>
          )}
        </Section>

        <Section icon={Users} title="Live visitors" hint="People on ThyAnime right now, including you. Updates instantly as people come and go.">
          <div className="flex items-center gap-4">
            <span className="relative flex h-3 w-3">
              <span className={'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ' + (online > 0 ? 'bg-emerald-400' : 'bg-zinc-500')} />
              <span className={'relative inline-flex h-3 w-3 rounded-full ' + (online > 0 ? 'bg-emerald-400' : 'bg-zinc-500')} />
            </span>
            <span className="text-4xl font-extrabold tabular-nums">{online === null ? '…' : online < 0 ? '—' : online.toLocaleString()}</span>
            <span className="text-sm text-zinc-400">{online === null ? 'connecting…' : online < 0 ? 'counter unavailable right now' : online === 1 ? 'person online' : 'people online'}</span>
          </div>
        </Section>
      </div>
    </div>
  )
}
