// The site is hosted separately; every API / player call goes to your ThyAnime server.
// Change it with NEXT_PUBLIC_API_BASE at build time (see README). Use '' for same-origin.
export const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.thyanime.me'

async function get(url, signal) {
  const r = await fetch(API + url, { signal })
  if (!r.ok) {
    let msg = 'Request failed (' + r.status + ')'
    try { const j = await r.json(); if (j && j.error) msg = j.error } catch (e) {}
    throw new Error(msg)
  }
  return r.json()
}

const qs = (p) => {
  const u = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.set(k, v) })
  return u.toString()
}

export const api = {
  home: (signal) => get('/api/site/home', signal),
  search: (p, signal) => get('/api/site/search?' + qs(p), signal),
  anime: ({ id, mal }, signal) => get('/api/site/anime?' + (id ? 'id=' + id : 'mal=' + mal), signal),
  episodes: (id, signal) => get('/api/episodes/' + id, signal),
}

export const animeHref = (a) => (a.id ? '/anime/?id=' + a.id : '/anime/?mal=' + a.malId)
export const watchHref = (id, ep, lang) => '/watch/?id=' + id + '&ep=' + ep + '&lang=' + (lang || 'sub')

// ── "continue watching" (kept in this browser only) ──
const KEY = 'thy_history_v1'
export function getHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch (e) { return [] }
}
export function pushHistory(item) {
  try {
    const list = getHistory().filter((x) => x.id !== item.id)
    list.unshift({ ...item, at: Date.now() })
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)))
  } catch (e) {}
}
export function getLang() {
  try { return localStorage.getItem('thy_lang') === 'dub' ? 'dub' : 'sub' } catch (e) { return 'sub' }
}
export function setLang(l) { try { localStorage.setItem('thy_lang', l) } catch (e) {} }

export const GENRES = ['Action','Adventure','Comedy','Drama','Ecchi','Fantasy','Horror','Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller']
export const STATUS_LABEL = { RELEASING: 'Airing', FINISHED: 'Finished', NOT_YET_RELEASED: 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'Hiatus' }
