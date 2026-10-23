'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Clock, Newspaper, Rocket, Star, History, RefreshCw } from 'lucide-react'
import AnimeCard from '../../components/AnimeCard'
import { GridSkeleton } from '../../components/Skeletons'
import { animeHref } from '../../lib/api'
import { airingBetween, upcoming, releaseLabel, daysUntil, countdown } from '../../lib/news'

const TABS = [
  ['schedule', 'Airing schedule', CalendarDays],
  ['soon', 'Coming soon', Rocket],
  ['recent', 'Just aired', History],
]

const DAY = 86400
const dayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

function Err({ msg, onRetry }) {
  return (
    <div className="glass mx-auto mt-6 max-w-xl rounded-2xl p-6 text-center">
      <p className="text-sm text-zinc-300">{msg}</p>
      <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-blossom-500 px-5 py-2 text-sm font-medium text-white transition hover:brightness-110"><RefreshCw size={14} /> Retry</button>
    </div>
  )
}

function Toggle({ on, onChange, children }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-zinc-300">
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={'relative h-5 w-9 rounded-full transition ' + (on ? 'bg-blossom-500' : 'bg-white/15')}>
        <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (on ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {children}
    </label>
  )
}

// ── one airing row ──────────────────────────────────────────────────────────
function AirRow({ s, now, i }) {
  const a = s.anime
  const when = new Date(s.airingAt * 1000)
  const past = s.airingAt * 1000 < now
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
      <Link href={animeHref(a)} className="glass group flex items-center gap-4 rounded-2xl p-3 transition hover:bg-white/10">
        <img src={a.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-24 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/10 sm:h-28 sm:w-20" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-blossom-400 sm:text-base">{a.title}</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Episode {s.episode}{a.episodes ? ' / ' + a.episodes : ''}
            {a.format ? ' · ' + a.format.replace('_', ' ') : ''}
            {a.studio ? ' · ' + a.studio : ''}
          </p>
          {a.genres.length ? <p className="mt-1 hidden truncate text-xs text-zinc-500 sm:block">{a.genres.slice(0, 3).join(' · ')}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold tabular-nums">{when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          <p className={'mt-0.5 text-xs font-medium ' + (past ? 'text-zinc-500' : 'text-emerald-300')}>{countdown(s.airingAt, now)}</p>
          {a.score ? <p className="mt-1 hidden items-center justify-end gap-1 text-xs text-zinc-400 sm:flex"><Star size={11} className="fill-yellow-400 text-yellow-400" />{(a.score / 10).toFixed(1)}</p> : null}
        </div>
      </Link>
    </motion.div>
  )
}

// ── Airing schedule (next 7 days, by day) ───────────────────────────────────
function Schedule({ now }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const [sel, setSel] = useState(0)
  const [allCountries, setAllCountries] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    setRows(null); setErr('')
    const from = Math.floor(startOfDay(new Date()).getTime() / 1000)
    airingBetween(from, from + 7 * DAY, {}, ac.signal)
      .then(setRows)
      .catch((e) => { if (e.name !== 'AbortError') setErr(e.message) })
    return () => ac.abort()
  }, [tick])

  const days = useMemo(() => {
    const base = startOfDay(new Date())
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d })
  }, [])

  const shown = useMemo(() => {
    if (!rows) return []
    const key = dayKey(days[sel])
    return rows
      .filter((s) => dayKey(new Date(s.airingAt * 1000)) === key)
      .filter((s) => allCountries || !s.anime.country || s.anime.country === 'JP')
  }, [rows, sel, days, allCountries])

  const counts = useMemo(() => {
    const c = days.map(() => 0)
    if (!rows) return c
    rows.forEach((s) => {
      if (!allCountries && s.anime.country && s.anime.country !== 'JP') return
      const i = days.findIndex((d) => dayKey(d) === dayKey(new Date(s.airingAt * 1000)))
      if (i >= 0) c[i]++
    })
    return c
  }, [rows, days, allCountries])

  const label = (d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short' }))

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {days.map((d, i) => (
          <button key={i} onClick={() => setSel(i)}
            className={'relative shrink-0 rounded-2xl px-4 py-2 text-center transition ' + (sel === i ? 'text-white' : 'glass text-zinc-400 hover:text-white')}>
            {sel === i ? <motion.span layoutId="daypill" className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blossom-500 to-accent" transition={{ type: 'spring', stiffness: 400, damping: 34 }} /> : null}
            <span className="relative block text-sm font-semibold">{label(d, i)}</span>
            <span className="relative block text-[11px] opacity-80">{d.toLocaleDateString([], { month: 'short', day: 'numeric' })}{rows ? ' · ' + counts[i] : ''}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-zinc-500"><Clock size={13} /> Times are in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p>
        <Toggle on={allCountries} onChange={setAllCountries}>Include donghua &amp; other countries</Toggle>
      </div>
      {err ? <Err msg={err} onRetry={() => setTick((t) => t + 1)} /> : !rows ? (
        <div className="mt-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}</div>
      ) : shown.length === 0 ? (
        <p className="glass mt-6 rounded-2xl p-8 text-center text-sm text-zinc-400">Nothing scheduled for this day.</p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={sel + String(allCountries)} className="mt-4 grid gap-3 lg:grid-cols-2">
            {shown.map((s, i) => <AirRow key={s.anime.id + '-' + s.episode} s={s} now={now} i={i} />)}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

// ── Just aired (last 48 h) ──────────────────────────────────────────────────
function Recent({ now }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const [allCountries, setAllCountries] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    setRows(null); setErr('')
    const to = Math.floor(Date.now() / 1000)
    airingBetween(to - 2 * DAY, to, { desc: true, maxPages: 4 }, ac.signal)
      .then(setRows)
      .catch((e) => { if (e.name !== 'AbortError') setErr(e.message) })
    return () => ac.abort()
  }, [tick])

  const shown = (rows || []).filter((s) => allCountries || !s.anime.country || s.anime.country === 'JP')
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">Episodes that aired in the last 48 hours — newest first.</p>
        <Toggle on={allCountries} onChange={setAllCountries}>Include donghua &amp; other countries</Toggle>
      </div>
      {err ? <Err msg={err} onRetry={() => setTick((t) => t + 1)} /> : !rows ? (
        <div className="mt-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}</div>
      ) : shown.length === 0 ? (
        <p className="glass mt-6 rounded-2xl p-8 text-center text-sm text-zinc-400">No recent episodes found.</p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {shown.map((s, i) => <AirRow key={s.anime.id + '-' + s.episode} s={s} now={now} i={i} />)}
        </div>
      )}
    </div>
  )
}

// ── Coming soon (new anime that haven't started) ────────────────────────────
function Soon() {
  const [sort, setSort] = useState('soon')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true); setErr(''); setItems([]); setPage(1)
    upcoming({ sort, page: 1 }, ac.signal)
      .then((d) => { setItems(d.results); setHasNext(d.hasNext); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [sort, tick])

  const loadMore = () => {
    const next = page + 1
    setMore(true)
    upcoming({ sort, page: next })
      .then((d) => {
        setItems((old) => { const seen = new Set(old.map((a) => a.id)); return old.concat(d.results.filter((a) => !seen.has(a.id))) })
        setPage(next); setHasNext(d.hasNext); setMore(false)
      })
      .catch(() => setMore(false))
  }

  const sub = useCallback((a) => {
    const n = daysUntil(a)
    const lbl = releaseLabel(a)
    return n !== null && n >= 0 ? lbl + (n === 0 ? ' · today' : n === 1 ? ' · tomorrow' : ' · in ' + n + ' days') : lbl
  }, [])

  const chip = (on) => 'relative rounded-full px-4 py-1.5 text-sm font-medium transition ' + (on ? 'text-white' : 'text-zinc-400 hover:text-white')
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[['soon', 'Releasing soonest'], ['popular', 'Most anticipated']].map(([k, n]) => (
          <button key={k} onClick={() => setSort(k)} className={chip(sort === k)}>
            {sort === k ? <motion.span layoutId="soonpill" className="absolute inset-0 rounded-full bg-gradient-to-r from-blossom-500 to-accent" /> : <span className="glass absolute inset-0 rounded-full" />}
            <span className="relative">{n}</span>
          </button>
        ))}
      </div>
      {err ? <Err msg={err} onRetry={() => setTick((t) => t + 1)} /> : loading ? <div className="mt-6"><GridSkeleton n={12} /></div> : items.length === 0 ? (
        <p className="glass mt-6 rounded-2xl p-8 text-center text-sm text-zinc-400">No upcoming anime found.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((a, i) => <AnimeCard key={a.id} a={a} i={i} sub={sub(a)} />)}
          </div>
          {hasNext ? (
            <div className="mt-8 text-center">
              <button onClick={loadMore} disabled={more} className="glass rounded-full px-8 py-2.5 text-sm font-medium transition hover:bg-blossom-500/30 disabled:opacity-60">{more ? 'Loading…' : 'Load more'}</button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default function News() {
  const [tab, setTab] = useState('schedule')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  // remember which tab was open via #hash (so the link can be shared / survives refresh)
  useEffect(() => {
    const h = window.location.hash.replace('#', '')
    if (TABS.some(([k]) => k === h)) setTab(h)
  }, [])
  const pick = (k) => { setTab(k); try { window.history.replaceState(null, '', '#' + k) } catch (e) {} }

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-24 sm:px-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold sm:text-4xl"><Newspaper className="text-blossom-400" size={30} /> <span className="text-grad">Anime News</span></h1>
        <p className="mt-2 text-sm text-zinc-400">Upcoming episodes and countdowns, brand-new anime that are about to premiere, and what just aired.</p>
      </motion.div>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map(([k, name, Icon]) => (
          <button key={k} onClick={() => pick(k)}
            className={'relative flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ' + (tab === k ? 'text-white' : 'glass text-zinc-300 hover:text-white')}>
            {tab === k ? <motion.span layoutId="newstab" className="absolute inset-0 rounded-full bg-gradient-to-r from-blossom-500 to-accent shadow-lg shadow-blossom-500/30" transition={{ type: 'spring', stiffness: 400, damping: 34 }} /> : null}
            <Icon size={16} className="relative" /><span className="relative">{name}</span>
          </button>
        ))}
      </div>

      {tab === 'schedule' ? <Schedule now={now} /> : tab === 'soon' ? <Soon /> : <Recent now={now} />}
      <p className="mt-10 text-center text-xs text-zinc-600">Schedule data from AniList. Air times can shift — streaming availability depends on your region.</p>
    </div>
  )
}
