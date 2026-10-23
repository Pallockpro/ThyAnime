// ─────────────────────────────────────────────────────────────────────────────
// YumeList provider — your self-hosted, read-only anime metadata API (https://…ngrok-free.dev).
// Sits in the data-source chain as a backup: AniList → Kitsu → YumeList → Jikan (Settings can move it first).
//
// Config (build time):
//   NEXT_PUBLIC_YUMELIST_API   base URL (default below). Set it to "off" to disable YumeList completely.
//
// What it supplies: home rails, search, anime details (+ relations, recommendations) and episode lists.
// Limits (from the YumeList docs): 80 requests/min per client → we stay under ~55/min, retry on 429/503 using
// Retry-After, 10 s timeout. Titles that have neither an AniList nor a MAL id are skipped: the site needs one of
// them to link and stream. Anything thrown here is caught upstream and the site just tries the next provider.
//
// IMPORTANT (browser site): YumeList's JSON endpoints only send CORS headers to an allow-list of origins, so your
// YumeList server must allow this site's origin (https://thyanime.me, https://pallockpro.github.io) and the request
// header `ngrok-skip-browser-warning` (only sent if ngrok's free-tier warning page shows up, so it can skip it).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE = 'https://doubling-supreme-resurrect.ngrok-free.dev'
const ENV = (process.env.NEXT_PUBLIC_YUMELIST_API || '').trim()
const OFF = ['off', '0', 'false', 'none', 'disabled'].includes(ENV.toLowerCase())
const BASE = (OFF ? '' : ENV || DEFAULT_BASE).replace(/\/+$/, '')
const API = BASE + '/api/v1'

const TIMEOUT = 10000
const PER_MIN = 55 // YumeList allows 80/min; stay well under
const TTL = { detail: 60 * 60 * 1000, list: 5 * 60 * 1000 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const aborted = (s) => !!(s && s.aborted)
const abortErr = () => { const e = new Error('Aborted'); e.name = 'AbortError'; return e }

// ── client-side throttle (sliding 60 s window) ──
const stamps = []
async function throttle(signal) {
  for (;;) {
    if (aborted(signal)) throw abortErr()
    const now = Date.now()
    while (stamps.length && now - stamps[0] > 60000) stamps.shift()
    if (stamps.length < PER_MIN) { stamps.push(now); return }
    await sleep(Math.min(stamps[0] + 60000 - now + 25, 5000))
  }
}

// ── is YumeList there? ──────────────────────────────────────────────────────
// If we can't reach it we try up to 3 times (one shared probe, not one per request), and only then give up and
// skip YumeList for a minute so every page doesn't wait on it again. Any HTTP answer at all (even an error status)
// counts as "it's there"; only network failures / timeouts / CORS blocks count as "not detected".
const PROBE_TRIES = 3
const PROBE_TIMEOUT = 4000
let upUntil = 0
let downUntil = 0
let probing = null

// ── ngrok free tier puts an HTML warning page in front of *browser* requests. We first ask WITHOUT any custom
// header (a plain "simple" request, so no CORS preflight can get in the way). If an HTML page comes back instead
// of JSON we switch, for good, to sending `ngrok-skip-browser-warning`, which makes ngrok pass the request through. ──
let skipHeader = false

// ── small response cache ──
const memo = new Map()

/** One fetch → parsed JSON. Throws: err.status for HTTP errors, err.html when ngrok's warning page came back. */
async function request(path, signal, timeout = TIMEOUT) {
  for (let pass = 0; pass < 2; pass++) {
    const ac = new AbortController()
    const onAbort = () => ac.abort()
    if (signal) { if (signal.aborted) ac.abort(); else signal.addEventListener('abort', onAbort) }
    const timer = setTimeout(() => ac.abort(), timeout)
    try {
      const headers = { Accept: 'application/json' }
      if (skipHeader) headers['ngrok-skip-browser-warning'] = 'true'
      const r = await fetch(API + path, { headers, signal: ac.signal })
      const ct = r.headers.get('content-type') || ''
      if (/html/i.test(ct) && !skipHeader) { skipHeader = true; continue } // ngrok interstitial → retry with the skip header
      if (/html/i.test(ct)) { const e = new Error('YumeList returned an HTML page instead of JSON'); e.html = true; e.status = r.status; throw e }
      if (!r.ok) { const e = new Error('YumeList HTTP ' + r.status); e.status = r.status; e.retryAfter = parseInt(r.headers.get('Retry-After'), 10) || 0; throw e }
      if (!/json/i.test(ct)) { const e = new Error('YumeList did not return JSON'); e.html = true; e.status = r.status; throw e }
      return await r.json()
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
  }
  throw new Error('YumeList unavailable')
}

/** Make sure YumeList is reachable (max 3 tries, shared by all concurrent requests). */
async function ensureUp(signal) {
  const now = Date.now()
  if (now < upUntil) return
  if (now < downUntil) throw new Error('YumeList temporarily unreachable')
  if (!probing) {
    probing = (async () => {
      let last = null
      for (let i = 0; i < PROBE_TRIES; i++) {
        try {
          await throttle(null)
          await request('/anime?limit=1', null, PROBE_TIMEOUT)
          upUntil = Date.now() + 60000
          return
        } catch (e) {
          if (e && e.status) { upUntil = Date.now() + 60000; return } // it answered → it is there (the real request handles the status)
          last = e
          if (i < PROBE_TRIES - 1) await sleep(500 * (i + 1))
        }
      }
      downUntil = Date.now() + 60000
      throw last || new Error('YumeList not detected')
    })().finally(() => { probing = null })
  }
  await probing
  if (aborted(signal)) throw abortErr()
}

/** GET <API><path> → parsed JSON. Retries 429/503/500 (honouring Retry-After); a 404 throws with status 404. */
async function get(path, signal, ttl = TTL.list) {
  const hit = memo.get(path)
  if (hit && hit.exp > Date.now()) return hit.v
  await ensureUp(signal)
  let lastErr = null
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle(signal)
    try {
      const v = await request(path, signal)
      memo.set(path, { exp: Date.now() + ttl, v })
      return v
    } catch (e) {
      if (aborted(signal)) throw abortErr()
      lastErr = e
      const busy = e && (e.status === 429 || e.status === 503 || e.status === 500)
      if (!busy) throw e // 404 / 400 = a normal miss; network errors were already handled by ensureUp
      if (attempt >= 2) throw e
      await sleep(Math.min((e.retryAfter || 1 + attempt) * 1000, 6000))
    }
  }
  throw lastErr || new Error('YumeList unavailable')
}

const q = (o) =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&')

// ── mapping: YumeList anime object → the site's normalised "card" ──
const absUrl = (u) => (!u ? null : /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? BASE + u : null)
const coverOf = (a) => {
  if (a.imageEndpoints && a.imageEndpoints.cover) return BASE + a.imageEndpoints.cover
  const img = (a.images || []).find((i) => i.type === 'COVER')
  return img ? absUrl(img.url) : null
}
const bannerOf = (a) => {
  if (a.imageEndpoints && a.imageEndpoints.banner) return BASE + a.imageEndpoints.banner
  const img = (a.images || []).find((i) => i.type === 'BANNER')
  return img ? absUrl(img.url) : null
}
const text = (s) => (s ? String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '')

function toCard(a) {
  const t = a.title || {}
  const ids = a.ids || {}
  const score = a.averageScore != null ? a.averageScore : a.meanScore
  return {
    id: ids.anilist || null,
    malId: ids.mal || null,
    yumeId: ids.yumelist || a.id || null,
    title: t.english || t.romaji || t.native || 'Untitled',
    romaji: t.romaji || null,
    native: t.native || null,
    cover: coverOf(a),
    banner: bannerOf(a),
    color: null,
    score: score != null ? Math.round(score) : null,
    format: a.type || null,
    year: a.seasonYear || (a.airedFrom ? new Date(a.airedFrom).getUTCFullYear() : null) || null,
    status: a.status || null,
    episodes: a.episodes || null,
    duration: a.duration || null,
    genres: a.genres || [],
    description: text(a.description),
  }
}
const usable = (a) => a && !a.isAdult && a.ids && (a.ids.anilist || a.ids.mal) // need an id to link + stream

const listOf = (j) => ({
  results: (j.data || []).filter(usable).map(toCard),
  hasNext: !!(j.pagination && j.pagination.hasNextPage),
})

function season(d = new Date()) {
  const m = d.getMonth()
  return { name: m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL', year: d.getFullYear() }
}
const SORT = { POPULARITY_DESC: 'popularity', TRENDING_DESC: 'popularity', FAVOURITES_DESC: 'popularity', SCORE_DESC: 'score', START_DATE_DESC: 'newest' }
const TYPES = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC']

/** Find the YumeList anime for an AniList id / MAL id (or a card that already knows its yumeId). */
async function lookup({ id, mal, yumeId }, signal) {
  if (yumeId) return (await get('/anime/' + encodeURIComponent(yumeId), signal, TTL.detail)).data
  if (id) {
    try { return (await get('/anime/anilist/' + encodeURIComponent(id), signal, TTL.detail)).data }
    catch (e) { if (!(e && e.status === 404) || !mal) throw e }
  }
  if (mal) return (await get('/anime/mal/' + encodeURIComponent(mal), signal, TTL.detail)).data
  throw new Error('Not found on YumeList')
}

export const yume = {
  enabled: !!BASE,
  base: BASE,

  async home(signal) {
    const s = season()
    const run = async (path) => listOf(await get(path, signal)).results
    const [trending, inSeason, popular, top, movies] = await Promise.all([
      run('/search?' + q({ status: 'RELEASING', sort: 'popularity', limit: 20 })),
      run('/search?' + q({ season: s.name, year: s.year, sort: 'popularity', limit: 20 })),
      run('/anime?' + q({ limit: 20 })),
      run('/search?' + q({ status: 'FINISHED', sort: 'score', limit: 20 })),
      run('/search?' + q({ type: 'MOVIE', sort: 'popularity', limit: 20 })),
    ])
    return { trending, season: inSeason, popular, top, movies }
  },

  async search({ q: text_, genre, format, sort, page }, signal) {
    const query = (text_ || '').trim().slice(0, 100)
    const type = TYPES.includes(format) ? format : ''
    const g = genre ? String(genre).toLowerCase().trim().replace(/\s+/g, '-') : ''
    const params = { q: query, genre: g, type, sort: SORT[sort] || 'popularity', page: page || 1, limit: 24 }
    if (!query && !g && !type) return listOf(await get('/anime?' + q({ page: params.page, limit: 24 }), signal)) // /search needs q or a filter
    return listOf(await get('/search?' + q(params), signal))
  },

  async anime({ id, mal }, signal) {
    const a = await lookup({ id, mal }, signal)
    if (!a) throw new Error('Not found on YumeList')
    const card = toCard(a)
    const yid = card.yumeId
    const [rel, rec] = await Promise.all([
      get('/anime/' + yid + '/relations', signal, TTL.detail).catch((e) => { if (aborted(signal)) throw abortErr(); return { data: [] } }),
      get('/anime/' + yid + '/recommendations?limit=12', signal, TTL.detail).catch((e) => { if (aborted(signal)) throw abortErr(); return { data: [] } }),
    ])
    const next = a.nextAiringEpisode
    return {
      ...card,
      cover: coverOf(a),
      studios: (a.studios || []).filter((x) => !x.role || x.role === 'STUDIO').map((x) => x.name),
      trailer: null, // YumeList has no trailer field
      nextAiring: next && next.episode && next.airingAt
        ? { episode: next.episode, airingAt: Math.floor(new Date(next.airingAt).getTime() / 1000) } // unix seconds, like AniList
        : null,
      streamingEpisodes: [],
      relations: (rel.data || []).filter((r) => r && usable(r.anime)).map((r) => ({ type: r.relationType, card: toCard(r.anime) })),
      recommendations: (rec.data || []).filter(usable).map(toCard),
    }
  },

  /** Episode list for a card (needs its AniList/MAL id). → { items: [{number,title,thumbnail,airdate,description,filler}], total } */
  async episodes(card, signal) {
    let yid = card.yumeId // cards that came from YumeList already know it; otherwise resolve via AniList / MAL id
    if (!yid) { const a = await lookup({ id: card.id, mal: card.malId }, signal); yid = a && ((a.ids && a.ids.yumelist) || a.id) }
    if (!yid) throw new Error('Not found on YumeList')
    const items = []
    for (let page = 1; page <= 10; page++) {
      const j = await get('/anime/' + yid + '/episodes?' + q({ page, limit: 100 }), signal, TTL.detail)
      for (const e of j.data || []) {
        if (!e || !e.number) continue
        items.push({
          number: e.number,
          title: e.title || '',
          thumbnail: absUrl(e.thumbnailUrl),
          airdate: e.airedAt ? String(e.airedAt).slice(0, 10) : '',
          description: text(e.description),
          filler: !!e.filler,
        })
      }
      if (!(j.pagination && j.pagination.hasNextPage)) break
    }
    return { items, total: items.reduce((m, e) => Math.max(m, e.number), 0) }
  },
}
