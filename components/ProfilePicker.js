'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Pencil, Plus } from 'lucide-react'
import { useAuth } from './AuthProvider'
import Avatar from './Avatar'
import Logo from './Logo'
import ProfileEditor from './ProfileEditor'
import { usernameOf } from '../lib/profiles'

/** "Who's watching?" — shown whenever a family account opens the site (once per browser session, and via Switch profile). */
export default function ProfilePicker() {
  const { user, profiles, profilesError, maxProfiles, selectProfile, signOut, manageOnOpen } = useAuth()
  const [manage, setManage] = useState(!!manageOnOpen)
  const [editor, setEditor] = useState(null) // { mode, profile }
  const list = profiles || []
  const canAdd = list.length < maxProfiles

  const tile = (p, i) => (
    <motion.button
      key={p.id} type="button"
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.35 }}
      whileHover={{ y: -4 }} onClick={() => (manage ? setEditor({ mode: 'edit', profile: p }) : selectProfile(p.id))}
      className="group flex w-28 flex-col items-center gap-3 outline-none sm:w-36"
    >
      <span className="relative block rounded-2xl ring-2 ring-transparent transition group-hover:ring-white/70 group-focus-visible:ring-white/70">
        <Avatar avatar={p.avatar} name={p.name} size={128} rounded="rounded-2xl" className="!h-28 !w-28 sm:!h-36 sm:!w-36" />
        {manage ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 text-white"><Pencil size={30} /></span>
        ) : null}
        {p.google ? <span title={p.google.email} className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-zinc-800 shadow">G</span> : null}
      </span>
      <span className="max-w-full truncate text-base font-medium text-zinc-300 transition group-hover:text-white">{p.name}</span>
    </motion.button>
  )

  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <p className="mb-8 flex items-center gap-2 text-lg font-extrabold tracking-tight"><Logo size={28} /><span className="text-grad">ThyAnime</span></p>
      <h1 className="text-3xl font-extrabold sm:text-5xl">{manage ? 'Manage profiles' : 'Who’s watching?'}</h1>
      <p className="mt-3 text-sm text-zinc-400">{manage ? 'Tap a profile to rename it, change its avatar, or link a Google account.' : <>Signed in as <span className="font-medium text-zinc-200">@{usernameOf(user && user.email)}</span></>}</p>

      {profilesError ? <p className="mt-6 max-w-md text-sm text-amber-300/90">Couldn’t load the profiles. The database rules probably haven’t been updated yet — see firebase/README.md.</p> : null}

      <div className="mt-10 flex max-w-4xl flex-wrap items-start justify-center gap-6 sm:gap-10">
        {list.map(tile)}
        <AnimatePresence>
          {canAdd && (manage || list.length === 0) ? (
            <motion.button key="add" type="button" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => setEditor({ mode: 'create' })} className="group flex w-28 flex-col items-center gap-3 outline-none sm:w-36">
              <span className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-600 text-zinc-400 transition group-hover:border-white group-hover:text-white sm:h-36 sm:w-36"><Plus size={44} /></span>
              <span className="text-base font-medium text-zinc-400 transition group-hover:text-white">Add profile</span>
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        {list.length ? (
          <button type="button" onClick={() => setManage((m) => !m)}
            className={'flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition ' + (manage ? 'bg-white text-zinc-900 hover:scale-[1.03]' : 'glass text-zinc-300 hover:bg-white/15 hover:text-white')}>
            {manage ? 'Done' : <><Pencil size={15} /> Manage profiles</>}
          </button>
        ) : null}
        <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-zinc-500 transition hover:text-white"><LogOut size={15} /> Sign out</button>
      </div>

      {editor ? <ProfileEditor mode={editor.mode} profile={editor.profile} onClose={() => setEditor(null)} /> : null}
    </main>
  )
}
