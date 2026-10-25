'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ArrowLeft, Server, AlertTriangle } from 'lucide-react'
import { api, animeHref, isSingleEpisode, pushHistory, setLang, singleLabel, watchHref } from '../../lib/api'
import { SERVERS, buildEmbed, getSessionServer, setSessionServer } from '../../lib/servers'
import { useAuth } from '../../components/AuthProvider'
import { useServerStatus } from '../../lib/useServerStatus'

function WatchInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const id = parseInt(sp.get('id') || '0', 10) || 0
  const malParam = parseInt(sp.get('mal') || '0', 10) || 0
  const ep = Math.max(1, parseInt(sp.get('ep') || '1', 10) || 1)
  const lang = sp.get('lang') === 'dub' ? 'dub' : 'sub'
  const [a, setA] = useState(null)
  const [eps, setEps] = useState([])
  const [epsDone, setEpsDone] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { settings } = useAuth()
  const [sess, setSess] = useState('') // server picked in the player this session (does not change the saved default)
  const up = useServerStatus() // liveness of servers that can be probed (your own server)
  const cur = useRef(null)
  const mal = malParam || (a && a.malId) || 0 // MAL id may only become known once metadata loads

  // metadata + episode list (the player below does NOT wait for these)
  useEffect(() => {
    if (!id && !malParam) return
    const ac = new AbortController()
    setEpsDone(false)
    api.anime({ id: id || undefined, mal: malParam || undefined }, ac.signal)
      .then((d) => { setA(d); return api.episodes(d, ac.signal) })
      .then((d) => { setEps(d.episodes || []); setEpsDone(true) })
      .catch((e) => { if (e.name !== 'AbortError') setEpsDone(true) })
    return () => ac.abort()
  }, [id, malParam])

  // which servers are reachable? (only matters for your own ThyAnime server; the other servers are third-party)
  useEffect(() => {
    setSess(getSessionServer())
  }, [])

  const params = { id, mal, ep, lang }
  const avail = SERVERS.filter((s) => buildEmbed(s, params))
  const usable = avail.filter((s) => up[s.key] !== false)
  const wanted = sp.get('srv') || sess || settings.server
  const server = usable.find((s) => s.key === wanted) || usable[0] || avail[0] || null
  const src = server ? buildEmbed(server, params) : null

  useEffect(() => { setLoaded(false) }, [id, mal, ep, lang, server && server.key])
  useEffect(() => {
    if (a) {
      pushHistory({ id: id || a.id || undefined, mal: mal || undefined, ep, lang, title: a.title, cover: a.cover })
      const e = eps.find((x) => x.number === ep)
      document.title = isSingleEpisode(a, eps) ? a.title + ' — ThyAnime' : a.title + ' · EP ' + ep + (e && e.title && e.title !== 'Episode ' + ep ? ' — ' + e.title : '') + ' — ThyAnime'
    }
  }, [a, eps, ep, lang, id, mal])
  useEffect(() => { if (cur.current) cur.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [eps, ep])

  if (!id && !malParam) return <div className="pt-32 text-center text-zinc-400">No anime selected. <Link href="/" className="text-blossom-400">Go home</Link></div>

  const total = eps.length || (a && a.episodes) || 0
  const single = isSingleEpisode(a, eps) // movie / one-episode title → no episode list, no Prev/Next
  const e = eps.find((x) => x.number === ep)
  const aniId = id || (a && a.id) || 0
  const go = (n, l) => router.push(watchHref(aniId, n, l || lang, mal))
  const pick = (k) => { setSessionServer(k); setSess(k); if (sp.get('srv')) router.replace(watchHref(aniId, ep, lang, mal)) }
  const pill = 'glass flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <div className="mx-auto max-w-[1700px] px-3 pb-6 pt-20 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={a ? animeHref(a) : '/'} className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm transition hover:bg-white/15"><ArrowLeft size={15} /> {a ? a.title : 'Back'}</Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[0_0_60px_rgb(var(--b500)/.15)] ring-1 ring-white/10">
            {src ? (
              <>
                {!loaded ? <div className="shimmer absolute inset-0 flex items-center justify-center"><span className="h-10 w-10 animate-spin rounded-full border-4 border-blossom-500 border-t-transparent" /></div> : null}
                {/* No sandbox attribute on purpose: MegaPlay (and most embed players) refuse sandboxed iframes. */}
                <iframe key={(server ? server.key : '') + '-' + id + '-' + mal + '-' + ep + '-' + lang} src={src} onLoad={() => setLoaded(true)}
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen
                  className="absolute inset-0 h-full w-full border-0" title="Player" />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-400">No streaming server can play this title (no usable AniList / MAL id).</div>
            )}
          </motion.div>

          {avail.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5 text-zinc-400"><Server size={14} /> Server</span>
              {avail.map((s) => {
                const down = up[s.key] === false
                const on = server && server.key === s.key
                return (
                  <button key={s.key} aria-disabled={down} onClick={() => { if (!down) pick(s.key) }}
                    title={down ? s.name + ' is down right now — try another server.' : undefined}
                    className={'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition ' + (down ? 'cursor-not-allowed bg-red-500/15 text-red-300 ring-1 ring-red-500/60' : on ? 'bg-blossom-500 text-white' : 'glass text-zinc-300 hover:bg-white/10')}>
                    {down ? <AlertTriangle size={14} className="shrink-0" /> : null}
                    {s.name}{down ? ' · server down' : ''}
                  </button>
                )
              })}
              <span className="text-xs text-zinc-500">Video not loading? Try another server.</span>
              {avail.some((s) => up[s.key] === false) ? (
                <p role="alert" className="flex w-full items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle size={14} className="shrink-0" /> The ThyAnime server isn’t responding right now. We switched you to another server — it will come back automatically when it’s up.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{a ? a.title : 'Loading…'}</h1>
              <p className="truncate text-sm text-zinc-400">{single ? singleLabel(a) : <>Episode {ep}{e && e.title && e.title !== 'Episode ' + ep ? ' — ' + e.title : ''}</>}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="glass relative flex rounded-full p-1">
                {['sub', 'dub'].map((l) => (
                  <button key={l} onClick={() => { setLang(l); go(ep, l) }} className={'relative rounded-full px-4 py-1.5 text-sm font-semibold uppercase transition ' + (lang === l ? 'text-white' : 'text-zinc-400')}>
                    {lang === l ? <motion.span layoutId="wlang" className="absolute inset-0 rounded-full bg-blossom-500" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                    <span className="relative">{l}</span>
                  </button>
                ))}
              </div>
              {single ? null : (
                <>
                  <button className={pill} disabled={ep <= 1} onClick={() => go(ep - 1)}><ChevronLeft size={16} /> Prev</button>
                  <button className={pill} disabled={total ? ep >= total : false} onClick={() => go(ep + 1)}>Next <ChevronRight size={16} /></button>
                </>
              )}
            </div>
          </div>
          {/* movie / single episode → the title's synopsis; otherwise the episode's own description */}
          {single
            ? (a && a.description ? <p className="glass mt-4 rounded-xl p-4 text-sm leading-relaxed text-zinc-300">{a.description}</p> : null)
            : (e && e.description ? <p className="glass mt-4 rounded-xl p-4 text-sm leading-relaxed text-zinc-300">{e.description}</p> : null)}
        </div>

        {single ? (
          // movie / single episode → poster card in the spot where the episode list normally sits
          <aside className="glass self-start overflow-hidden rounded-2xl">
            {a ? (
              <Link href={animeHref(a)} className="group block">
                <div className="relative aspect-[2/3] w-full bg-plum">
                  {a.cover ? <img src={a.cover} alt={a.title} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : null}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-16">
                    <p className="line-clamp-2 text-lg font-bold leading-snug">{a.title}</p>
                    <p className="mt-1 text-xs text-zinc-300">
                      {[singleLabel(a), a.year, a.duration ? a.duration + ' min' : '', a.score ? '★ ' + (a.score / 10).toFixed(1) : ''].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </Link>
            ) : <div className="shimmer aspect-[2/3] w-full" />}
          </aside>
        ) : <aside className="glass flex max-h-[78vh] flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Episodes {total ? <span className="font-normal text-zinc-500">· {total}</span> : null}</div>
          <div className="no-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
            {eps.length === 0 ? (epsDone
              ? <p className="p-4 text-sm text-zinc-500">No episode list available for this title. Use Prev / Next to move between episodes.</p>
              : Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-lg" />)) : eps.map((x) => {
              const on = x.number === ep
              return (
                <Link key={x.number} ref={on ? cur : null} href={watchHref(aniId, x.number, lang, mal)}
                  className={'flex items-center gap-3 rounded-lg p-2 transition ' + (on ? 'bg-blossom-500/20 ring-1 ring-blossom-500/60' : 'hover:bg-white/5')}>
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-plum">
                    {x.thumbnail ? <img src={x.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : null}
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold">{x.number}</span>
                  </div>
                  <span className={'line-clamp-2 text-sm ' + (on ? 'font-semibold text-blossom-300' : 'text-zinc-300')}>{x.title}</span>
                </Link>
              )
            })}
          </div>
        </aside>}
      </div>
    </div>
  )
}

export default function WatchPage() {
  return <Suspense fallback={<div className="px-4 pt-24"><div className="shimmer aspect-video rounded-2xl" /></div>}><WatchInner /></Suspense>
}
