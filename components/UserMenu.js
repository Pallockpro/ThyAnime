'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { LogIn, LogOut, Settings } from 'lucide-react'
import { useAuth } from './AuthProvider'

export default function UserMenu() {
  const { user, authReady, signIn, signOut, authError, clearAuthError } = useAuth()
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) { setOpen(false); clearAuthError() } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [clearAuthError])

  const initial = ((user && (user.displayName || user.email)) || '?').trim().charAt(0).toUpperCase()

  return (
    <div ref={box} className="relative flex items-center gap-2">
      <Link href="/settings/" aria-label="Settings" title="Settings" className="glass rounded-full p-2.5 text-zinc-300 transition hover:bg-white/15 hover:text-white">
        <Settings size={18} />
      </Link>

      {!authReady ? (
        <span className="glass h-10 w-10 rounded-full" />
      ) : user ? (
        <button onClick={() => setOpen((o) => !o)} aria-label="Account" className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-blossom-500/60 transition hover:ring-blossom-400">
          {user.photoURL
            ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center bg-blossom-500 font-bold">{initial}</span>}
        </button>
      ) : (
        <button onClick={signIn} className="glass flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium transition hover:bg-white/15">
          <LogIn size={16} /><span className="hidden sm:inline">Sign in</span>
        </button>
      )}

      <AnimatePresence>
        {(open && user) || authError ? (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}
            className="glass absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl bg-plum/95 shadow-2xl">
            {authError ? <p className="p-3 text-xs text-amber-300/90">{authError}</p> : null}
            {open && user ? (
              <>
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-sm font-semibold">{user.displayName || 'ThyAnime user'}</p>
                  <p className="truncate text-xs text-zinc-400">{user.email}</p>
                </div>
                <Link href="/settings/" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm transition hover:bg-white/10"><Settings size={15} /> Settings</Link>
                <button onClick={() => { setOpen(false); signOut() }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-white/10"><LogOut size={15} /> Sign out</button>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
