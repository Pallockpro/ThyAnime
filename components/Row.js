'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import AnimeCard from './AnimeCard'

// Poster height (w-36 → 216px, sm:w-44 → 264px at 2:3) so the edge arrows sit exactly over the posters.
const STRIP_H = 'h-[216px] sm:h-[264px]'

/** Dark, blurred edge strip with an arrow — click anywhere on it to scroll that way (desktop; touch users just swipe). */
function Edge({ side, onClick }) {
  const right = side === 'right'
  const fade = 'linear-gradient(to ' + (right ? 'left' : 'right') + ', #000 35%, transparent)'
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className={'pointer-events-none absolute top-2 z-20 hidden w-20 sm:block sm:w-24 ' + STRIP_H + ' ' + (right ? '-right-4 sm:-right-8' : '-left-4 sm:-left-8')}
    >
      <div
        className={'absolute inset-0 backdrop-blur-[3px] ' + (right ? 'bg-gradient-to-l' : 'bg-gradient-to-r') + ' from-black/80 via-black/45 to-transparent'}
        style={{ WebkitMaskImage: fade, maskImage: fade }}
      />
      <button
        type="button" onClick={onClick} aria-label={right ? 'Scroll right' : 'Scroll left'}
        className={'group/edge pointer-events-auto absolute inset-0 flex items-center ' + (right ? 'justify-end pr-5 sm:pr-9' : 'justify-start pl-5 sm:pl-9')}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur transition duration-200 group-hover/edge:scale-110 group-hover/edge:bg-blossom-500 group-hover/edge:ring-blossom-400">
          {right ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
        </span>
      </button>
    </motion.div>
  )
}

export default function Row({ title, items, hrefFor, subFor }) {
  const ref = useRef(null)
  const [canL, setCanL] = useState(false)
  const [canR, setCanR] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    // the strip has px-2 (8px) and snap-start, so its true "start" rests at scrollLeft ≈ 8 — threshold must be above that
    setCanL(el.scrollLeft > 16)
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 16)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure) }
  }, [measure, items])

  if (!items || !items.length) return null
  const scroll = (d) => ref.current && ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.85, behavior: 'smooth' })

  return (
    <section className="group/row px-4 sm:px-8">
      <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-xl font-semibold sm:text-2xl">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-blossom-400 to-accent" />{title}
        </h2>
      </motion.div>
      <div className="relative">
        <AnimatePresence>{canL ? <Edge key="l" side="left" onClick={() => scroll(-1)} /> : null}</AnimatePresence>
        <AnimatePresence>{canR ? <Edge key="r" side="right" onClick={() => scroll(1)} /> : null}</AnimatePresence>
        <div ref={ref} className="no-scrollbar -mx-2 flex snap-x scroll-px-2 gap-4 overflow-x-auto overflow-y-hidden px-2 pb-4 pt-3">
          {items.map((a, i) => (
            <div key={(a.id || a.malId) + '-' + i} className="w-36 shrink-0 snap-start sm:w-44">
              <AnimeCard a={a} i={i} href={hrefFor ? hrefFor(a) : undefined} sub={subFor ? subFor(a) : undefined} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
