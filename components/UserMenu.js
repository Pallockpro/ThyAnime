'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { LogIn, LogOut, Pencil, Settings, Users } from 'lucide-react'
import { useAuth } from './AuthProvider'
import Avatar from './Avatar'
import ProfileEditor from './ProfileEditor'

export default function UserMenu() {
  const { user, me, isFamily, authReady, signOut, switchProfile, authError, clearAuthError } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) { setOpen(false); clearAuthError() } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [clearAuthError])

  const item = 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-white/10'

  return (
    <div ref={box} className="relative flex items-center gap-2">
      <Link href="/settings/" aria-label="Settings" title="Settings" className="glass rounded-full p-2.5 text-zinc-300 transition hover:bg-white/15 hover:text-white">
        <Settings size={18} />
      </Link>

      {!authReady ? (
        <span className="glass h-10 w-10 rounded-full" />
      ) : user && me ? (
        <button onClick={() => setOpen((o) => !o)} aria-label="Account" className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-blossom-500/60 transition hover:ring-blossom-400">
          <Avatar avatar={me.avatar} photo={me.photo} name={me.name} size={40} />
        </button>
      ) : (
        <Link href="/login/" className="glass flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium transition hover:bg-white/15">
          <LogIn size={16} /><span className="hidden sm:inline">Sign in</span>
        </Link>
      )}

      <AnimatePresence>
        {(open && user) || authError ? (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}
            className="menu-panel absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl shadow-2xl">
            {authError ? <p className="p-3 text-xs text-amber-300/90">{authError}</p> : null}
            {open && user && me ? (
              <>
                <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                  <Avatar avatar={me.avatar} photo={me.photo} name={me.name} size={40} rounded="rounded-xl" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{me.name}</p>
                    <p className="truncate text-xs text-zinc-400">{me.sub}</p>
                  </div>
                </div>
                <button onClick={() => { setOpen(false); setEditing(true) }} className={item}><Pencil size={15} /> {me.kind === 'google' ? 'Edit name' : 'Edit profile'}</button>
                {isFamily ? (
                  <>
                    <button onClick={() => { setOpen(false); switchProfile() }} className={item}><Users size={15} /> Switch profile</button>
                    <button onClick={() => { setOpen(false); switchProfile({ manage: true }) }} className={item}><Settings size={15} /> Manage profiles</button>
                  </>
                ) : null}
                <Link href="/settings/" onClick={() => setOpen(false)} className={item}><Settings size={15} /> Settings</Link>
                <button onClick={() => { setOpen(false); signOut() }} className={item + ' text-zinc-300'}><LogOut size={15} /> Sign out</button>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {editing ? <ProfileEditor mode="edit" self onClose={() => setEditing(false)} /> : null}
    </div>
  )
}
