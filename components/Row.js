'use client'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import AnimeCard from './AnimeCard'

export default function Row({ title, items, hrefFor, subFor }) {
  const ref = useRef(null)
  if (!items || !items.length) return null
  const scroll = (d) => ref.current && ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  return (
    <section className="group/row px-4 sm:px-8">
      <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-xl font-semibold sm:text-2xl">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-blossom-400 to-violet-500" />{title}
        </h2>
        <div className="hidden gap-2 sm:flex">
          <button onClick={() => scroll(-1)} aria-label="Scroll left" className="glass rounded-full p-2 transition hover:bg-blossom-500/30"><ChevronLeft size={18} /></button>
          <button onClick={() => scroll(1)} aria-label="Scroll right" className="glass rounded-full p-2 transition hover:bg-blossom-500/30"><ChevronRight size={18} /></button>
        </div>
      </motion.div>
      <div ref={ref} className="no-scrollbar -mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-4 pt-2">
        {items.map((a, i) => (
          <div key={(a.id || a.malId) + '-' + i} className="w-36 shrink-0 snap-start sm:w-44">
            <AnimeCard a={a} i={i} href={hrefFor ? hrefFor(a) : undefined} sub={subFor ? subFor(a) : undefined} />
          </div>
        ))}
      </div>
    </section>
  )
}
