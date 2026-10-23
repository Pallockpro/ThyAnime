'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

// Shown once after leaving the hidden /lockemup meme page (the page sets a sessionStorage flag when you go back).
// Disappears by itself after 6 seconds.
export const MEME_FLAG = 'thy_meme_back'
const SHOW_MS = 6000

export default function MemeToast() {
  const pathname = usePathname()
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (pathname.startsWith('/lockemup')) return
    let flagged = false
    try { flagged = sessionStorage.getItem(MEME_FLAG) === '1'; if (flagged) sessionStorage.removeItem(MEME_FLAG) } catch (e) {}
    if (!flagged) return
    setOn(true)
    const t = setTimeout(() => setOn(false), SHOW_MS)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <AnimatePresence>
      {on ? (
        <motion.div key="meme" role="status"
          initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="menu-panel fixed left-1/2 top-[calc(var(--banner-h,0px)+5rem)] z-[250] w-[min(92vw,26rem)] -translate-x-1/2 overflow-hidden rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/15">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-2xl" aria-hidden>😅</span>
            <p className="flex-1 text-sm font-medium text-zinc-100">My bad, but that&rsquo;s just a meme page.</p>
            <button onClick={() => setOn(false)} aria-label="Dismiss" className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"><X size={16} /></button>
          </div>
          <motion.div initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: SHOW_MS / 1000, ease: 'linear' }}
            style={{ transformOrigin: 'left' }} className="h-0.5 bg-gradient-to-r from-blossom-400 to-accent" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
