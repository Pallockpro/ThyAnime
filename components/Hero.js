'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, Info, Star } from 'lucide-react'
import { animeHref, watchHref, getLang, STATUS_LABEL } from '../lib/api'

const DELAY = 8000

export default function Hero({ items }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = items.length
  useEffect(() => {
    if (paused || n < 2) return
    const t = setTimeout(() => setI((x) => (x + 1) % n), DELAY)
    return () => clearTimeout(t)
  }, [i, paused, n])
  if (!n) return null
  const a = items[i]
  const img = a.banner || a.cover
  return (
    <section className="relative h-[72vh] min-h-[440px] w-full overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <AnimatePresence mode="sync">
        <motion.div key={(a.id || a.malId) + '-bg'} className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }}>
          <img src={img} alt="" referrerPolicy="no-referrer"
            className={'h-full w-full animate-kenburns object-cover ' + (a.banner ? '' : 'scale-125 blur-md brightness-75')} />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />

      <div className="relative z-10 flex h-full max-w-3xl flex-col justify-end px-4 pb-20 sm:px-8 sm:pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={(a.id || a.malId) + '-txt'}
            initial="h" animate="s" exit="x"
            variants={{ h: {}, s: { transition: { staggerChildren: 0.09 } }, x: { transition: { staggerChildren: 0.03 } } }}>
            <motion.div variants={{ h: { opacity: 0, y: 24 }, s: { opacity: 1, y: 0 }, x: { opacity: 0, y: -10 } }}
              className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-blossom-500 px-3 py-1 text-white">#{i + 1} Spotlight</span>
              {a.score ? <span className="flex items-center gap-1 text-zinc-200"><Star size={13} className="fill-yellow-400 text-yellow-400" />{(a.score / 10).toFixed(1)}</span> : null}
              {a.format ? <span className="text-zinc-300">{a.format.replace('_', ' ')}</span> : null}
              {a.year ? <span className="text-zinc-300">{a.year}</span> : null}
              {STATUS_LABEL[a.status] ? <span className="text-emerald-300">{STATUS_LABEL[a.status]}</span> : null}
            </motion.div>
            <motion.h1 variants={{ h: { opacity: 0, y: 30 }, s: { opacity: 1, y: 0 }, x: { opacity: 0 } }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl font-extrabold leading-tight drop-shadow-lg sm:text-5xl">{a.title}</motion.h1>
            <motion.p variants={{ h: { opacity: 0, y: 24 }, s: { opacity: 1, y: 0 }, x: { opacity: 0 } }}
              className="mt-4 line-clamp-3 max-w-xl text-sm text-zinc-300 sm:text-base">{a.description}</motion.p>
            <motion.div variants={{ h: { opacity: 0, y: 24 }, s: { opacity: 1, y: 0 }, x: { opacity: 0 } }} className="mt-6 flex flex-wrap gap-3">
              {a.id || a.malId ? (
                <Link href={watchHref(a.id, 1, getLang(), a.malId)}
                  className="group flex items-center gap-2 rounded-full bg-blossom-500 px-6 py-3 font-semibold text-white shadow-[0_0_30px_rgb(var(--b500)/.45)] transition hover:scale-105 hover:bg-blossom-600">
                  <Play size={18} className="fill-white transition-transform group-hover:translate-x-0.5" /> Watch now
                </Link>
              ) : null}
              <Link href={animeHref(a)} className="glass flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition hover:bg-white/15">
                <Info size={18} /> Details
              </Link>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {n > 1 ? (
        <div className="absolute bottom-6 right-4 z-10 flex gap-2 sm:right-8">
          {items.map((x, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={'Slide ' + (k + 1)}
              className="relative h-1.5 w-8 overflow-hidden rounded-full bg-white/20">
              {k === i ? (
                <motion.span key={i + String(paused)} className="absolute inset-y-0 left-0 rounded-full bg-blossom-400"
                  initial={{ width: 0 }} animate={{ width: paused ? '0%' : '100%' }} transition={{ duration: paused ? 0 : DELAY / 1000, ease: 'linear' }} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
