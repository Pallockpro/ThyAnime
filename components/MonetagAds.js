'use client'
import { useEffect } from 'react'

/* ── Ad frequency settings (edit these) ─────────────────────────────
   GAP_MIN     minutes that must pass between two ads
   MAX_ADS     ads allowed per window; after this many, ads stop...
   RESET_HOURS ...until this many hours have passed since the first ad, then it starts over
   The counters live in the visitor's browser (localStorage), so they survive reloads and new tabs. */
const GAP_MIN = 30
const MAX_ADS = 4
const RESET_HOURS = 3

// Tags take turns: ad 1 = zone A, ad 2 = zone B, ad 3 = zone A, ad 4 = zone B
const TAGS = [
  { id: 'monetag-tag-1', zone: '12194696', src: 'https://nap5k.com/tag.min.js' },
  { id: 'monetag-tag-2', zone: '11194022', src: 'https://al5sm.com/tag.min.js' },
]

const KEY = 'thy-ads'
const GAP = GAP_MIN * 60 * 1000
const RESET = RESET_HOURS * 60 * 60 * 1000
let memory = { count: 0, first: 0, last: 0 } // fallback if localStorage is blocked

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && typeof v.count === 'number') return v
  } catch (e) {}
  return memory
}
function write(v) {
  memory = v
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch (e) {}
}

function inject(t) {
  const old = document.getElementById(t.id)
  if (old) old.remove() // re-adding the tag makes it run again
  const s = document.createElement('script')
  s.id = t.id
  s.dataset.zone = t.zone
  s.src = t.src
  s.async = true
  ;(document.body || document.documentElement).appendChild(s)
}

function tick() {
  const now = Date.now()
  let st = read()
  if (st.first && now - st.first >= RESET) st = { count: 0, first: 0, last: 0 } // pause is over
  if (st.count >= MAX_ADS) { write(st); return }                                  // cap reached → wait
  if (st.last && now - st.last < GAP) return                                      // too soon → wait
  inject(TAGS[st.count % TAGS.length])
  write({ count: st.count + 1, first: st.first || now, last: now })
}

export default function MonetagAds() {
  useEffect(() => {
    tick()                                  // on page load
    const id = setInterval(tick, 60 * 1000) // and once a minute, so people who stay on the site get the next ad on time
    return () => clearInterval(id)
  }, [])
  return null
}
