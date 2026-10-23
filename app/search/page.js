'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import AnimeCard from '../../components/AnimeCard'
import { GridSkeleton } from '../../components/Skeletons'
import { api, GENRES, expectedProvider, SOURCE_LABEL } from '../../lib/api'
import Logo from '../../components/Logo'

const FORMATS = [['', 'All'], ['TV', 'TV'], ['MOVIE', 'Movie'], ['OVA', 'OVA'], ['ONA', 'ONA'], ['SPECIAL', 'Special']]
const SORTS = [['', 'Best match'], ['POPULARITY_DESC', 'Popular'], ['TRENDING_DESC', 'Trending'], ['SCORE_DESC', 'Top rated'], ['START_DATE_DESC', 'Newest'], ['FAVOURITES_DESC', 'Most loved']]

function SearchInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const q = sp.get('q') || ''
  const genre = sp.get('genre') || ''
  const format = sp.get('format') || ''
  const sort = sp.get('sort') || ''
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [provider, setProvider] = useState('')
  const [err, setErr] = useState('')

  const setParam = useCallback((k, v) => {
    const u = new URLSearchParams(sp.toString())
    if (v) u.set(k, v); else u.delete(k)
    router.replace('/search/?' + u.toString())
  }, [sp, router])

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true); setErr(''); setItems([]); setPage(1)
    api.search({ q, genre, format, sort, page: 1 }, ac.signal)
      .then((d) => { setItems(d.results || []); setHasNext(!!d.hasNext); setProvider(d.provider || ''); setLoading(false); if (d.error) setErr(d.error) })
      .catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [q, genre, format, sort])

  const loadMore = () => {
    const next = page + 1
    setMore(true)
    api.search({ q, genre, format, sort, page: next })
      .then((d) => {
        setItems((old) => {
          const seen = new Set(old.map((a) => (a.id || 'm' + a.malId)))
          return old.concat((d.results || []).filter((a) => !seen.has(a.id || 'm' + a.malId)))
        })
        setPage(next); setHasNext(!!d.hasNext); setMore(false)
      })
      .catch(() => setMore(false))
  }

  const chip = (on) => 'relative rounded-full px-4 py-1.5 text-sm font-medium transition ' + (on ? 'text-white' : 'text-zinc-400 hover:text-white')

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-24 sm:px-8">
      <h1 className="text-2xl font-bold sm:text-3xl">
        {q ? <>Results for <span className="text-grad">“{q}”</span></> : 'Browse anime'}
      </h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="glass flex flex-wrap rounded-full p-1">
          {FORMATS.map(([v, label]) => (
            <button key={v} onClick={() => setParam('format', v)} className={chip(format === v)}>
              {format === v ? <motion.span layoutId="fmtpill" className="absolute inset-0 rounded-full bg-blossom-500" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        <select value={genre} onChange={(e) => setParam('genre', e.target.value)}
          className="glass rounded-full bg-plum px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-blossom-500">
          <option value="">All genres</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value)}
          className="glass rounded-full bg-plum px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-blossom-500">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {provider && provider !== expectedProvider() ? (
        <p className="mt-4 text-xs text-amber-300/80">{SOURCE_LABEL[expectedProvider()]} is unavailable right now — showing results from {SOURCE_LABEL[provider] || provider}.{provider === 'jikan' ? ' (genre filter may be ignored)' : ''}</p>
      ) : null}

      <div className="mt-8">
        {loading ? <GridSkeleton n={18} /> : err && !items.length ? (
          <p className="py-20 text-center text-zinc-400">{err}</p>
        ) : items.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-24 text-center">
            <div className="animate-float flex justify-center"><Logo size={64} /></div>
            <p className="mt-4 text-zinc-400">Nothing found. Try another spelling or fewer filters.</p>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((a, i) => <AnimeCard key={(a.id || 'm' + a.malId) + '-' + i} a={a} i={i} />)}
            </div>
            <AnimatePresence>
              {hasNext ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-12 flex justify-center">
                  <button onClick={loadMore} disabled={more}
                    className="glass rounded-full px-8 py-3 font-semibold transition hover:bg-blossom-500/30 disabled:opacity-60">
                    {more ? 'Loading…' : 'Load more'}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return <Suspense fallback={<div className="px-4 pt-24 sm:px-8"><GridSkeleton n={12} /></div>}><SearchInner /></Suspense>
}
