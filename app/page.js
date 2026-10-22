'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Hero from '../components/Hero'
import Row from '../components/Row'
import { HeroSkeleton, RowSkeleton } from '../components/Skeletons'
import { api, getHistory, watchHref } from '../lib/api'

const RAILS = [
  ['trending', 'Trending now'],
  ['season', 'Airing this season'],
  ['popular', 'All-time popular'],
  ['top', 'Top rated'],
  ['movies', 'Movies'],
]

export default function Home() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [hist, setHist] = useState([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const f = () => setHist(getHistory())
    f()
    window.addEventListener('thy-history', f) // fires when account history arrives after sign-in
    return () => window.removeEventListener('thy-history', f)
  }, [])
  useEffect(() => {
    const ac = new AbortController()
    setErr(''); setData(null)
    api.home(ac.signal).then(setData).catch((e) => { if (e.name !== 'AbortError') setErr(e.message) })
    return () => ac.abort()
  }, [tick])

  const rails = (data && data.rails) || {}
  const base = rails.trending && rails.trending.length ? rails.trending : (rails.popular || [])
  const withBanner = base.filter((a) => a.banner)
  const hero = (withBanner.length >= 3 ? withBanner : base).slice(0, 6)

  return (
    <div>
      {err ? (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg text-zinc-300">Couldn’t load anime right now.</p>
          <p className="text-sm text-zinc-500">{err}</p>
          <button onClick={() => setTick((t) => t + 1)} className="rounded-full bg-blossom-500 px-6 py-2.5 font-semibold transition hover:scale-105">Try again</button>
        </div>
      ) : !data ? (
        <>
          <HeroSkeleton />
          <div className="mt-10 space-y-10"><RowSkeleton /><RowSkeleton /></div>
        </>
      ) : (
        <>
          <Hero items={hero} />
          {data.provider && data.provider !== 'anilist' ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pt-4 text-xs text-amber-300/80 sm:px-8">
              AniList is unavailable right now — showing data from {data.provider}.
            </motion.p>
          ) : null}
          <div className="-mt-10 space-y-10 pt-6">
            {hist.length ? (
              <Row title="Continue watching" items={hist}
                hrefFor={(h) => watchHref(h.id, h.ep, h.lang, h.mal)}
                subFor={(h) => 'Episode ' + h.ep + (h.lang === 'dub' ? ' · Dub' : '')} />
            ) : null}
            {RAILS.map(([k, title]) => <Row key={k} title={title} items={rails[k]} />)}
          </div>
        </>
      )}
    </div>
  )
}
