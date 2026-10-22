'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play, Star } from 'lucide-react'
import { animeHref, STATUS_LABEL } from '../lib/api'

export default function AnimeCard({ a, i = 0, href, sub }) {
  const glow = a.color || '#ff6fa8'
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: (i % 6) * 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className="group relative w-full"
    >
      <Link href={href || animeHref(a)} className="block outline-none">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-plum ring-1 ring-white/10 transition-shadow duration-300 group-hover:ring-blossom-500/60"
          style={{ '--g': glow }}>
          {a.cover ? (
            <img src={a.cover} alt={a.title} loading="lazy" referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-plum to-ink text-4xl text-blossom-400">{a.title?.[0]}</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-80 transition-opacity group-hover:opacity-100" />
          {a.score ? (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium backdrop-blur">
              <Star size={11} className="fill-yellow-400 text-yellow-400" />{(a.score / 10).toFixed(1)}
            </span>
          ) : null}
          {a.format ? (
            <span className="absolute right-2 top-2 rounded-full bg-blossom-500/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
              {a.format.replace('_', ' ')}
            </span>
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
            <span className="flex h-14 w-14 scale-75 items-center justify-center rounded-full bg-blossom-500 text-white shadow-[0_0_40px_var(--g)] transition-transform duration-300 group-hover:scale-100">
              <Play size={22} className="ml-0.5 fill-white" />
            </span>
          </div>
          {a.episodes ? (
            <span className="absolute bottom-2 left-2 text-[11px] font-medium text-zinc-200">{a.episodes} eps</span>
          ) : a.status === 'RELEASING' ? (
            <span className="absolute bottom-2 left-2 text-[11px] font-medium text-emerald-300">Airing</span>
          ) : null}
        </div>
        <h3 className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug text-zinc-100 transition-colors group-hover:text-blossom-400">{a.title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{sub || [a.year, STATUS_LABEL[a.status]].filter(Boolean).join(' · ')}</p>
      </Link>
    </motion.div>
  )
}
