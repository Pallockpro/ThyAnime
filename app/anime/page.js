'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, Star, Clock, Youtube } from 'lucide-react'
import Row from '../../components/Row'
import { api, getHistory, getLang, setLang, watchHref, isSingleEpisode, STATUS_LABEL, expectedProvider, SOURCE_LABEL } from '../../lib/api'

const CHUNK = 100

function Chip({ children, accent }) {
  return <span className={'rounded-full px-3 py-1 text-xs font-medium ' + (accent ? 'bg-blossom-500/90 text-white' : 'glass text-zinc-200')}>{children}</span>
}

function AnimeInner() {
  const sp = useSearchParams()
  const idParam = sp.get('id')
  const malParam = sp.get('mal')
  const [a, setA] = useState(null)
  const [eps, setEps] = useState(null)
  const [err, setErr] = useState('')
  const [lang, setL] = useState('sub')
  const [chunk, setChunk] = useState(0)
  const [more, setMore] = useState(false)
  const [last, setLast] = useState(null)

  useEffect(() => { setL(getLang()) }, [])
  useEffect(() => {
    if (!a) return
    const f = () => setLast(getHistory().find((x) => (x.id && x.id === a.id) || (x.mal && x.mal === a.malId)) || null)
    window.addEventListener('thy-history', f)
    return () => window.removeEventListener('thy-history', f)
  }, [a])
  useEffect(() => {
    const ac = new AbortController()
    setA(null); setEps(null); setErr(''); setChunk(0); setMore(false)
    api.anime({ id: idParam, mal: malParam }, ac.signal)
      .then((d) => {
        setA(d)
        const h = getHistory().find((x) => (x.id && x.id === d.id) || (x.mal && x.mal === d.malId))
        setLast(h || null)
        if (d.title) document.title = d.title + ' — ThyAnime'
        return api.episodes(d, ac.signal).then(setEps).catch((e) => { if (e.name !== 'AbortError') setEps({ episodes: [], total: 0 }) })
      })
      .catch((e) => { if (e.name !== 'AbortError') setErr(e.message) })
    return () => ac.abort()
  }, [idParam, malParam])

  const list = (eps && eps.episodes) || []
  const chunks = Math.ceil(list.length / CHUNK)
  const shown = useMemo(() => list.slice(chunk * CHUNK, chunk * CHUNK + CHUNK), [list, chunk])

  if (err) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 pt-20 text-center">
      <p className="text-4xl">🥀</p><p className="text-lg text-zinc-300">Couldn’t load this anime.</p><p className="text-sm text-zinc-500">{err}</p>
      <Link href="/" className="mt-2 rounded-full bg-blossom-500 px-6 py-2.5 font-semibold">Back home</Link>
    </div>
  )
  if (!a) return (
    <div className="px-4 pt-24 sm:px-8">
      <div className="shimmer h-64 w-full rounded-2xl" />
      <div className="mt-6 flex gap-6"><div className="shimmer h-72 w-48 shrink-0 rounded-xl" /><div className="flex-1 space-y-3"><div className="shimmer h-8 w-2/3 rounded" /><div className="shimmer h-4 w-full rounded" /><div className="shimmer h-4 w-5/6 rounded" /></div></div>
    </div>
  )

  const startEp = last && last.ep ? last.ep : 1
  const canWatch = !!(a.id || a.malId)
  const single = isSingleEpisode(a, eps && eps.episodes) // movie / one-episode title → no episode list
  const pickLang = (l) => { setL(l); setLang(l) }
  const trailer = a.trailer && a.trailer.site === 'youtube' && a.trailer.id ? 'https://www.youtube.com/watch?v=' + a.trailer.id : null

  return (
    <div>
      <div className="relative h-[46vh] min-h-[300px] w-full overflow-hidden">
        <img src={a.banner || a.cover} alt="" referrerPolicy="no-referrer" className={'h-full w-full object-cover ' + (a.banner ? '' : 'scale-125 blur-xl')} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
      </div>

      <div className="relative z-10 mx-auto -mt-44 max-w-[1400px] px-4 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row">
          <motion.img initial={{ opacity: 0, y: 40, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            src={a.cover} alt={a.title} referrerPolicy="no-referrer"
            className="mx-auto w-48 shrink-0 self-start rounded-2xl object-cover shadow-2xl ring-1 ring-white/15 md:mx-0 md:w-64" />
          <motion.div initial="h" animate="s" variants={{ h: {}, s: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }} className="min-w-0 flex-1 pt-2 md:pt-16">
            <motion.h1 variants={{ h: { opacity: 0, y: 24 }, s: { opacity: 1, y: 0 } }} className="text-3xl font-extrabold leading-tight sm:text-4xl">{a.title}</motion.h1>
            {a.native || (a.romaji && a.romaji !== a.title) ? (
              <motion.p variants={{ h: { opacity: 0 }, s: { opacity: 1 } }} className="mt-1 text-sm text-zinc-400">{a.romaji !== a.title ? a.romaji : ''}{a.native ? ' · ' + a.native : ''}</motion.p>
            ) : null}
            <motion.div variants={{ h: { opacity: 0, y: 16 }, s: { opacity: 1, y: 0 } }} className="mt-4 flex flex-wrap items-center gap-2">
              {a.score ? <Chip accent><span className="inline-flex items-center gap-1"><Star size={12} className="fill-white" />{(a.score / 10).toFixed(1)}</span></Chip> : null}
              {a.format ? <Chip>{a.format.replace('_', ' ')}</Chip> : null}
              {a.year ? <Chip>{a.year}</Chip> : null}
              {STATUS_LABEL[a.status] ? <Chip>{STATUS_LABEL[a.status]}</Chip> : null}
              {a.duration ? <Chip><span className="inline-flex items-center gap-1"><Clock size={12} />{a.duration} min</span></Chip> : null}
              {(a.studios || []).slice(0, 2).map((s) => <Chip key={s}>{s}</Chip>)}
            </motion.div>
            {a.genres && a.genres.length ? (
              <motion.div variants={{ h: { opacity: 0 }, s: { opacity: 1 } }} className="mt-3 flex flex-wrap gap-2">
                {a.genres.map((g) => <Link key={g} href={'/search/?genre=' + encodeURIComponent(g)} className="text-sm text-blossom-400 transition hover:text-blossom-300">#{g}</Link>)}
              </motion.div>
            ) : null}
            <motion.p variants={{ h: { opacity: 0, y: 16 }, s: { opacity: 1, y: 0 } }} className="mt-5 max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">
              {a.description || 'No synopsis available.'}
            </motion.p>
            {a.nextAiring ? <p className="mt-3 text-sm text-emerald-300">Next episode {a.nextAiring.episode}{a.nextAiring.airingAt ? ' · ' + new Date(a.nextAiring.airingAt * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}</p> : null}

            <motion.div variants={{ h: { opacity: 0, y: 16 }, s: { opacity: 1, y: 0 } }} className="mt-6 flex flex-wrap items-center gap-3">
              {canWatch ? (
                <Link href={watchHref(a.id, startEp, lang, a.malId)}
                  className="flex items-center gap-2 rounded-full bg-blossom-500 px-7 py-3 font-semibold text-white shadow-[0_0_30px_rgba(255,111,168,.4)] transition hover:scale-105 hover:bg-blossom-600">
                  <Play size={18} className="fill-white" /> {single ? (last ? 'Continue watching' : a.format === 'MOVIE' ? 'Watch Movie' : 'Watch Now') : last ? 'Continue EP ' + startEp : 'Watch EP 1'}
                </Link>
              ) : <span className="text-sm text-zinc-500">Streaming isn’t available for this title (no AniList or MAL id found).</span>}
              <div className="glass relative flex rounded-full p-1">
                {['sub', 'dub'].map((l) => (
                  <button key={l} onClick={() => pickLang(l)} className={'relative rounded-full px-5 py-2 text-sm font-semibold uppercase transition ' + (lang === l ? 'text-white' : 'text-zinc-400')}>
                    {lang === l ? <motion.span layoutId="langpill" className="absolute inset-0 rounded-full bg-white/15" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                    <span className="relative">{l}</span>
                  </button>
                ))}
              </div>
              {trailer ? <a href={trailer} target="_blank" rel="noreferrer" className="glass flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition hover:bg-white/15"><Youtube size={16} /> Trailer</a> : null}
            </motion.div>
            {a.provider && a.provider !== expectedProvider() ? <p className="mt-3 text-xs text-amber-300/80">Details from {SOURCE_LABEL[a.provider] || a.provider} ({SOURCE_LABEL[expectedProvider()]} unavailable).</p> : null}
          </motion.div>
        </div>

        {canWatch && !single ? (
          <section className="mt-14">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-xl font-semibold sm:text-2xl"><span className="h-6 w-1 rounded-full bg-gradient-to-b from-blossom-400 to-violet-500" />Episodes {list.length ? <span className="text-sm font-normal text-zinc-500">({list.length})</span> : null}</h2>
              {chunks > 1 ? (
                <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto">
                  {Array.from({ length: chunks }).map((_, k) => (
                    <button key={k} onClick={() => setChunk(k)} className={'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ' + (chunk === k ? 'bg-blossom-500 text-white' : 'glass text-zinc-300 hover:bg-white/10')}>
                      {k * CHUNK + 1}–{Math.min(list.length, (k + 1) * CHUNK)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {!eps ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-28 rounded-xl" />)}</div>
            ) : list.length === 0 ? (
              <p className="text-sm text-zinc-500">No episode list yet — it may not have started airing.</p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={chunk} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((e, i) => (
                    <motion.div key={e.number} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} whileHover={{ y: -4 }}>
                      <Link href={watchHref(a.id, e.number, lang, a.malId)} className="glass group flex gap-3 overflow-hidden rounded-xl p-2 transition hover:ring-1 hover:ring-blossom-500/60">
                        <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-plum">
                          {e.thumbnail ? <img src={e.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /> : null}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100"><Play size={22} className="fill-white" /></span>
                          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[11px] font-semibold">EP {e.number}</span>
                        </div>
                        <div className="min-w-0 py-1">
                          <p className="line-clamp-2 text-sm font-medium transition group-hover:text-blossom-400">{e.title}</p>
                          <p className="mt-1 text-xs text-zinc-500">{e.airdate || ''}{e.filler ? ' · Filler' : ''}</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </section>
        ) : null}
      </div>

      <div className="mt-14 space-y-10">
        <Row title="Related" items={(a.relations || []).map((r) => ({ ...r.card, _rel: r.type }))} subFor={(x) => (x._rel || '').replace(/_/g, ' ').toLowerCase()} />
        <Row title="You might also like" items={a.recommendations} />
      </div>
    </div>
  )
}

export default function AnimePage() {
  return <Suspense fallback={<div className="px-4 pt-24 sm:px-8"><div className="shimmer h-64 rounded-2xl" /></div>}><AnimeInner /></Suspense>
}
