'use client'
import { motion } from 'framer-motion'
import { Wrench, LogIn, LogOut } from 'lucide-react'
import { useAuth } from './AuthProvider'

export default function Maintenance() {
  const { maintenance, user, signIn, signOut, authError, authReady } = useAuth()
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="max-w-xl">
        <motion.div animate={{ rotate: [0, -14, 14, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
          className="glass mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl text-blossom-400 shadow-[0_0_60px_rgba(255,111,168,.25)]">
          <Wrench size={44} />
        </motion.div>
        <p className="text-grad text-lg font-extrabold tracking-tight">👑 ThyAnime</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{maintenance.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-300">{maintenance.message}</p>
        {maintenance.eta ? (
          <p className="glass mx-auto mt-6 inline-block rounded-full px-5 py-2 text-sm text-zinc-300">
            Expected back: <span className="font-semibold text-blossom-300">{maintenance.eta}</span>
          </p>
        ) : null}

        <div className="mt-12 text-xs text-zinc-600">
          {user ? (
            <p>
              Signed in as {user.email}. This account isn’t an admin.{' '}
              <button onClick={signOut} className="inline-flex items-center gap-1 text-zinc-400 underline-offset-2 hover:text-blossom-400 hover:underline"><LogOut size={12} /> Sign out</button>
            </p>
          ) : authReady ? (
            <button onClick={signIn} className="inline-flex items-center gap-1.5 text-zinc-500 transition hover:text-blossom-400"><LogIn size={12} /> Admin sign in</button>
          ) : null}
          {authError ? <p className="mt-2 text-amber-300/80">{authError}</p> : null}
        </div>
      </motion.div>
    </main>
  )
}
