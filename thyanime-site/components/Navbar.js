'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { api, animeHref } from '../lib/api'

const LINKS = [
  ['Home', '/'],
  ['Browse', '/search/'],
  ['Trending', '/search/?sort=TRENDING_DESC'],
  ['Movies', '/search/?format=MOVIE'],
]

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)      // mobile search bar
  const [sugg, setSugg] = useState([])
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 24)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  useEffect(() => { setFocus(false); setOpen(false); setSugg([]) }, [pathname])

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setSugg([]); setBusy(false); return }
    setBusy(true)
    const ac = new AbortController()
    const id = setTimeout(() => {
      api.search({ q: t, page: 1 }, ac.signal)
        .then((d) => { setSugg((d.results || []).slice(0, 6)); setBusy(false) })
        .catch((e) => { if (e.name !== 'AbortError') setBusy(false) })
    }, 320)
    return () => { clearTimeout(id); ac.abort() }
  }, [q])

  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setFocus(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const submit = (e) => {
    e.preventDefault()
    const t = q.trim()
    if (!t) return
    setFocus(false)
    router.push('/search/?q=' + encodeURIComponent(t))
  }

  return (
    <header className={'fixed inset-x-0 top-0 z-50 transition-all duration-300 ' + (scrolled ? 'bg-ink/80 shadow-lg shadow-black/30 backdrop-blur-xl' : 'bg-gradient-to-b from-black/70 to-transparent')}>
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <motion.span whileHover={{ rotate: -12, scale: 1.2 }} className="inline-block">👑</motion.span>
          <span className="text-grad">ThyAnime</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map(([name, href]) => {
            const active = href === '/' ? pathname === '/' : href === '/search/' && pathname.startsWith('/search')
            return (
              <Link key={name} href={href} className="relative rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white">
                {active ? <motion.span layoutId="navpill" className="absolute inset-0 rounded-full bg-white/10" transition={{ type: 'spring', stiffness: 400, damping: 32 }} /> : null}
                <span className="relative">{name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div ref={box} className={open ? 'fixed inset-x-3 top-3 z-50 md:static md:inset-auto' : 'hidden md:block'}>
            <form onSubmit={submit} className={'glass flex items-center gap-2 rounded-full px-4 py-2 transition-all duration-300 ' + (focus ? 'w-full ring-1 ring-blossom-500/70 md:w-80' : 'w-full md:w-56')}>
              <Search size={16} className="shrink-0 text-zinc-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)}
                placeholder="Search anime…" autoComplete="off"
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500" />
              {busy ? <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blossom-500 border-t-transparent" /> : null}
              {open ? <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button> : null}
            </form>
            <AnimatePresence>
              {focus && q.trim().length >= 2 && (sugg.length > 0 || !busy) ? (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="glass absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl bg-plum/95 shadow-2xl md:left-auto md:w-96">
                  {sugg.length === 0 ? <p className="p-4 text-sm text-zinc-400">No results.</p> : sugg.map((a, k) => (
                    <motion.div key={(a.id || a.malId) + '-' + k} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.04 }}>
                      <Link href={animeHref(a)} className="flex items-center gap-3 px-3 py-2 transition hover:bg-white/10">
                        <img src={a.cover} alt="" referrerPolicy="no-referrer" className="h-14 w-10 rounded-md object-cover" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{a.title}</span>
                          <span className="block text-xs text-zinc-400">{[a.format && a.format.replace('_', ' '), a.year, a.episodes && a.episodes + ' eps'].filter(Boolean).join(' · ')}</span>
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                  {sugg.length > 0 ? (
                    <button onClick={submit} className="w-full border-t border-white/10 p-3 text-center text-sm font-medium text-blossom-400 transition hover:bg-white/5">See all results</button>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {!open ? (
            <button onClick={() => setOpen(true)} aria-label="Search" className="glass rounded-full p-2.5 md:hidden"><Search size={18} /></button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
