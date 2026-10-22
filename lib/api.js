// ─────────────────────────────────────────────────────────────────────────────
// ThyAnime data layer — 100% client-side, no ThyAnime server required.
//
//   metadata : AniList (primary) → Kitsu → YumeList (your self-hosted API) → Jikan (MyAnimeList)
//   episodes : Kitsu → Jikan → YumeList → AniList streamingEpisodes → plain 1..N from the episode count
//   playback : iframe servers in lib/servers.js (MegaPlay, FilmU, optionally your own server)
//
// Every function returns the same normalised "card" shape no matter which provider answered:
//   { id (AniList id|null), malId, title, romaji, native, cover, banner, color, score (0-100),
//     format, year, status, episodes, duration, genres[], studios[], description, trailer, ... }
// ─────────────────────────────────────────────────────────────────────────────
import { yume } from './yumelist'

const ANILIST = 'https://graphql.anilist.co'
const KITSU = 'https://kitsu.io/api/edge'
const JIKAN = 'https://api.jikan.moe/v4'
const KITSU_OPTS = { headers: { Accept: 'application/vnd.api+json' } }

const MIN = 60 * 1000

// ── small helpers ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const aborted = (signal) => !!(signal && signal.aborted)
const abortErr = () => { const e = new Error('Aborted'); e.name = 'AbortError'; return e }

const clean = (s) =>
  s
    ? String(s)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/\(Source:[^)]*\)/gi, '')
        .replace(/\[Written by [^\]]*\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    : ''

const qs = (o) =>
  Object.entries(o || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&')

/** fetch → JSON with a timeout. A caller abort and a timeout are both AbortErrors; callers check `signal.aborted`. */
async function http(url, opts = {}, signal, ms = 9000) {
  const ac = new AbortController()
  const onAbort = () => ac.abort()
  if (signal) { if (signal.aborted) ac.abort(); else signal.addEventListener('abort', onAbort) }
  const t = setTimeout(() => ac.abort(), ms)
  try {
    const r = await fetch(url, { ...opts, signal: ac.signal })
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e }
    return await r.json()
  } finally {
    clearTimeout(t)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

// memory + sessionStorage cache so we stay well inside AniList (90/min) and Jikan (60/min) limits
const mem = new Map()
async function cached(key, ttl, fn) {
  const hit = mem.get(key)
  if (hit && hit.exp > Date.now()) return hit.v
  try {
    const raw = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('thy_c_' + key)
    if (raw) { const o = JSON.parse(raw); if (o.exp > Date.now()) { mem.set(key, o); return o.v } }
  } catch (e) {}
  const v = await fn()
  const o = { exp: Date.now() + ttl, v }
  mem.set(key, o)
  try { sessionStorage.setItem('thy_c_' + key, JSON.stringify(o)) } catch (e) {}
  return v
}

/** Try each [name, fn] in order; return [name, value] from the first that succeeds. */
async function chain(steps, signal) {
  let last = null
  for (const [name, fn] of steps) {
    if (aborted(signal)) throw abortErr()
    try { return [name, await fn()] } catch (e) { if (aborted(signal)) throw abortErr(); last = e }
  }
  throw last || new Error('All data sources are unavailable right now.')
}

// ── data-source preference (Settings → Data source) ─────────────────────────
// 'auto' = the default order below. Picking one source puts it FIRST; the others stay as automatic fallbacks,
// so the site never goes blank just because the chosen source is having a bad day.
export const SOURCES = [
  { key: 'auto', name: 'Automatic', note: 'AniList → Kitsu → YumeList → Jikan, in that order (recommended).' },
  { key: 'anilist', name: 'AniList', note: 'Rich details, banners and trailers.' },
  { key: 'kitsu', name: 'Kitsu', note: 'Good episode titles and thumbnails.' },
  { key: 'yumelist', name: 'YumeList', note: 'Your self-hosted YumeList server. Works great as a backup.', needsSetup: true },
  { key: 'jikan', name: 'Jikan / MyAnimeList', note: 'MyAnimeList data (a bit slower).' },
]
export const SOURCE_KEYS = SOURCES.map((x) => x.key)
export const SOURCE_LABEL = { anilist: 'AniList', kitsu: 'Kitsu', yumelist: 'YumeList', jikan: 'Jikan (MyAnimeList)' }
export function getSource() {
  try { const v = localStorage.getItem('thy_source'); return SOURCE_KEYS.includes(v) ? v : 'auto' } catch (e) { return 'auto' }
}
export function setSource(v) { try { localStorage.setItem('thy_source', v && v !== 'auto' ? v : 'auto') } catch (e) {} }
/** Which provider the user expects data from (used for the "…is unavailable" notice). */
export function expectedProvider() {
  const pref = getSource()
  return pref !== 'auto' && (pref !== 'yumelist' || yume.enabled) ? pref : 'anilist'
}

/** Default order AniList → Kitsu → (YumeList, if configured) → Jikan, with the preferred source moved to the front. */
const sources = (anilist, kitsu, yumelist, jk) => {
  const all = [
    ['anilist', anilist],
    ['kitsu', kitsu],
    ...(yume.enabled ? [['yumelist', yumelist]] : []),
    ['jikan', jk],
  ]
  const pref = getSource()
  const first = all.find(([n]) => n === pref)
  return pref !== 'auto' && first ? [first, ...all.filter((x) => x !== first)] : all
}

// ── season helper ────────────────────────────────────────────────────────────
function currentSeason(d = new Date()) {
  const m = d.getMonth()
  const name = ['WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL', 'WINTER'][m]
  return { name, year: m === 11 ? d.getFullYear() + 1 : d.getFullYear() }
}

// ═════════════════════════════════════════════════════════════════════════════
// AniList (GraphQL) — primary
// ═════════════════════════════════════════════════════════════════════════════
const M = `fragment M on Media { id idMal title { romaji english native } coverImage { large extraLarge color } bannerImage averageScore format status seasonYear startDate { year } episodes duration genres }`

async function gql(query, variables, signal) {
  const j = await http(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  }, signal)
  if (!j.data) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || 'AniList error')
  return j.data
}

function fromAniList(m) {
  const t = m.title || {}
  return {
    id: m.id,
    malId: m.idMal || null,
    title: t.english || t.romaji || t.native || 'Untitled',
    romaji: t.romaji || null,
    native: t.native || null,
    cover: m.coverImage ? m.coverImage.large || m.coverImage.extraLarge : null,
    banner: m.bannerImage || null,
    color: m.coverImage ? m.coverImage.color : null,
    score: m.averageScore || null,
    format: m.format || null,
    year: m.seasonYear || (m.startDate && m.startDate.year) || null,
    status: m.status || null,
    episodes: m.episodes || null,
    duration: m.duration || null,
    genres: m.genres || [],
    description: clean(m.description),
  }
}

const alRails = async (signal) => {
  const s = currentSeason()
  const d = await gql(
    `query($season: MediaSeason, $year: Int) {
      trending: Page(perPage: 20) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ...M description(asHtml: false) } }
      season:   Page(perPage: 20) { media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ...M } }
      popular:  Page(perPage: 20) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ...M } }
      top:      Page(perPage: 20) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ...M } }
      movies:   Page(perPage: 20) { media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC, isAdult: false) { ...M } }
    } ${M}`,
    { season: s.name, year: s.year }, signal)
  const out = {}
  for (const k of ['trending', 'season', 'popular', 'top', 'movies']) out[k] = (d[k].media || []).map(fromAniList)
  return out
}

const alSearch = async ({ q, genre, format, sort, page }, signal) => {
  const d = await gql(
    `query($q: String, $page: Int, $genre: String, $format: MediaFormat, $sort: [MediaSort]) {
      Page(page: $page, perPage: 24) {
        pageInfo { hasNextPage }
        media(type: ANIME, search: $q, genre: $genre, format: $format, sort: $sort, isAdult: false) { ...M }
      }
    } ${M}`,
    { q: q || undefined, page: page || 1, genre: genre || undefined, format: format || undefined, sort: [sort || (q ? 'SEARCH_MATCH' : 'POPULARITY_DESC')] },
    signal)
  return { results: d.Page.media.map(fromAniList), hasNext: !!d.Page.pageInfo.hasNextPage }
}

const alAnime = async ({ id, mal }, signal) => {
  const d = await gql(
    `query($id: Int, $mal: Int) {
      Media(id: $id, idMal: $mal, type: ANIME) {
        ...M description(asHtml: false)
        studios(isMain: true) { nodes { name } }
        trailer { id site }
        nextAiringEpisode { episode airingAt }
        streamingEpisodes { title thumbnail }
        relations { edges { relationType node { ...M type } } }
        recommendations(sort: RATING_DESC, perPage: 12) { nodes { mediaRecommendation { ...M } } }
      }
    } ${M}`,
    { id: id ? +id : undefined, mal: mal ? +mal : undefined }, signal)
  const m = d.Media
  if (!m) throw new Error('Not found on AniList')
  return {
    ...fromAniList(m),
    cover: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || null,
    studios: ((m.studios && m.studios.nodes) || []).map((s) => s.name),
    trailer: m.trailer ? { site: m.trailer.site, id: m.trailer.id } : null,
    nextAiring: m.nextAiringEpisode ? { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt } : null,
    streamingEpisodes: m.streamingEpisodes || [],
    relations: ((m.relations && m.relations.edges) || [])
      .filter((e) => e.node && e.node.type === 'ANIME')
      .map((e) => ({ type: e.relationType, card: fromAniList(e.node) })),
    recommendations: ((m.recommendations && m.recommendations.nodes) || [])
      .map((n) => n.mediaRecommendation).filter(Boolean).map(fromAniList),
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Kitsu (JSON:API) — first backup, also the main source of episode titles + thumbnails
// ═════════════════════════════════════════════════════════════════════════════
const K_STATUS = { current: 'RELEASING', finished: 'FINISHED', tba: 'NOT_YET_RELEASED', unreleased: 'NOT_YET_RELEASED', upcoming: 'NOT_YET_RELEASED' }
const K_FORMAT = { TV: 'TV', movie: 'MOVIE', OVA: 'OVA', ONA: 'ONA', special: 'SPECIAL', music: 'MUSIC' }
const K_SORT = { POPULARITY_DESC: 'popularityRank', TRENDING_DESC: 'popularityRank', SCORE_DESC: 'ratingRank', START_DATE_DESC: '-startDate', FAVOURITES_DESC: '-favoritesCount' }
const K_FORMAT_REV = { TV: 'TV', MOVIE: 'movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'special' }

const indexIncluded = (j) => new Map((j.included || []).map((x) => [x.type + ':' + x.id, x]))

function fromKitsu(item, inc) {
  const a = item.attributes || {}
  const rel = item.relationships || {}
  const maps = ((rel.mappings && rel.mappings.data) || []).map((r) => inc.get('mappings:' + r.id)).filter(Boolean)
  const ext = (site) => {
    const m = maps.find((x) => x.attributes && x.attributes.externalSite === site)
    return (m && parseInt(m.attributes.externalId, 10)) || null
  }
  const genres = ((rel.genres && rel.genres.data) || []).map((r) => inc.get('genres:' + r.id)).filter(Boolean).map((g) => g.attributes.name)
  const t = a.titles || {}
  const rating = parseFloat(a.averageRating)
  return {
    id: ext('anilist/anime'),
    malId: ext('myanimelist/anime'),
    kitsuId: item.id,
    title: t.en || t.en_us || a.canonicalTitle || 'Untitled',
    romaji: t.en_jp || a.canonicalTitle || null,
    native: t.ja_jp || null,
    cover: a.posterImage ? a.posterImage.large || a.posterImage.original : null,
    banner: a.coverImage ? a.coverImage.large || a.coverImage.original : null,
    color: null,
    score: isNaN(rating) ? null : Math.round(rating),
    format: K_FORMAT[a.subtype] || null,
    year: a.startDate ? parseInt(a.startDate.slice(0, 4), 10) : null,
    status: K_STATUS[a.status] || null,
    episodes: a.episodeCount || null,
    duration: a.episodeLength || null,
    genres,
    studios: [],
    description: clean(a.synopsis),
    trailer: a.youtubeVideoId ? { site: 'youtube', id: a.youtubeVideoId } : null,
  }
}

async function kitsuList(params, signal) {
  const j = await http(`${KITSU}/anime?${qs({ include: 'mappings', 'page[limit]': 20, ...params })}`, KITSU_OPTS, signal)
  const inc = indexIncluded(j)
  return {
    results: (j.data || []).map((x) => fromKitsu(x, inc)).filter((c) => c.id || c.malId), // no id = can't stream = useless
    hasNext: !!(j.links && j.links.next),
  }
}

const kRails = async (signal) => {
  const s = currentSeason()
  const [trending, season, popular, top, movies] = await Promise.all([
    kitsuList({ 'filter[status]': 'current', sort: 'popularityRank' }, signal),
    kitsuList({ 'filter[season]': s.name.toLowerCase(), 'filter[seasonYear]': s.year, sort: 'popularityRank' }, signal),
    kitsuList({ sort: 'popularityRank' }, signal),
    kitsuList({ sort: 'ratingRank' }, signal),
    kitsuList({ 'filter[subtype]': 'movie', sort: 'popularityRank' }, signal),
  ])
  return { trending: trending.results, season: season.results, popular: popular.results, top: top.results, movies: movies.results }
}

const kSearch = ({ q, genre, format, sort, page }, signal) =>
  kitsuList({
    'filter[text]': q,
    'filter[genres]': genre ? genre.toLowerCase().replace(/\s+/g, '-') : '',
    'filter[subtype]': K_FORMAT_REV[format] || '',
    sort: K_SORT[sort] || '',
    'page[offset]': ((page || 1) - 1) * 20,
  }, signal)

/** AniList/MAL id → Kitsu anime id, using Kitsu's mapping table. */
async function kitsuId({ id, malId }, signal) {
  return cached('kid:' + (id || '') + ':' + (malId || ''), 24 * 60 * MIN, async () => {
    for (const [site, ext] of [['anilist/anime', id], ['myanimelist/anime', malId]]) {
      if (!ext) continue
      try {
        const j = await http(`${KITSU}/mappings?${qs({ 'filter[externalSite]': site, 'filter[externalId]': ext, include: 'item' })}`, KITSU_OPTS, signal)
        const item = (j.included || []).find((x) => x.type === 'anime')
        if (item) return item.id
      } catch (e) { if (aborted(signal)) throw abortErr() }
    }
    return null
  })
}

const kAnime = async ({ id, mal }, signal) => {
  const kid = await kitsuId({ id, malId: mal }, signal)
  if (!kid) throw new Error('Not found on Kitsu')
  const j = await http(`${KITSU}/anime/${kid}?include=mappings,genres`, KITSU_OPTS, signal)
  return fromKitsu(j.data, indexIncluded(j))
}

/** Per-episode info from Kitsu (first 100 episodes — 5 parallel pages of 20, the API's max page size). */
async function kitsuEpisodes(a, signal) {
  const kid = a.kitsuId || (await kitsuId(a, signal))
  if (!kid) throw new Error('No Kitsu mapping')
  const page = (n) => http(`${KITSU}/anime/${kid}/episodes?${qs({ 'page[limit]': 20, 'page[offset]': n * 20, sort: 'number' })}`, KITSU_OPTS, signal)
  const first = await page(0)
  const total = (first.meta && first.meta.count) || (first.data || []).length
  const more = await Promise.all(
    Array.from({ length: Math.max(0, Math.min(Math.ceil(total / 20), 5) - 1) }, (_, i) =>
      page(i + 1).catch((e) => { if (aborted(signal)) throw abortErr(); return { data: [] } })))
  const items = [first, ...more].flatMap((p) => p.data || []).map((e) => ({
    number: e.attributes.number,
    title: e.attributes.canonicalTitle || (e.attributes.titles && (e.attributes.titles.en_us || e.attributes.titles.en_jp)) || '',
    thumbnail: e.attributes.thumbnail ? e.attributes.thumbnail.original : null,
    airdate: e.attributes.airdate || '',
    description: clean(e.attributes.synopsis),
  }))
  return { items, total }
}

// ═════════════════════════════════════════════════════════════════════════════
// Jikan (unofficial MyAnimeList API) — last-resort backup. Rate-limited, so requests are queued.
// ═════════════════════════════════════════════════════════════════════════════
const J_FORMAT = { TV: 'TV', Movie: 'MOVIE', OVA: 'OVA', ONA: 'ONA', Special: 'SPECIAL', 'TV Special': 'SPECIAL', Music: 'MUSIC' }
const J_STATUS = { 'Finished Airing': 'FINISHED', 'Currently Airing': 'RELEASING', 'Not yet aired': 'NOT_YET_RELEASED' }
const J_TYPE_REV = { TV: 'tv', MOVIE: 'movie', OVA: 'ova', ONA: 'ona', SPECIAL: 'special' }
const J_SORT = {
  POPULARITY_DESC: { order_by: 'popularity', sort: 'asc' }, // MAL popularity is a rank: 1 = most popular
  TRENDING_DESC: { order_by: 'popularity', sort: 'asc', status: 'airing' },
  SCORE_DESC: { order_by: 'score', sort: 'desc' },
  START_DATE_DESC: { order_by: 'start_date', sort: 'desc' },
  FAVOURITES_DESC: { order_by: 'favorites', sort: 'desc' },
}

let jikanQueue = Promise.resolve()
function jikan(path, signal) {
  const run = jikanQueue.then(() => { if (aborted(signal)) throw abortErr(); return http(JIKAN + path, {}, signal, 12000) })
  jikanQueue = run.catch(() => {}).then(() => sleep(380)) // ≤ 3 req/s
  return run
}

function fromJikan(m) {
  const img = m.images && ((m.images.webp && m.images.webp.large_image_url) || (m.images.jpg && m.images.jpg.large_image_url))
  const from = m.aired && m.aired.prop && m.aired.prop.from
  return {
    id: null,
    malId: m.mal_id,
    title: m.title_english || m.title || 'Untitled',
    romaji: m.title || null,
    native: m.title_japanese || null,
    cover: img || null,
    banner: null,
    color: null,
    score: m.score ? Math.round(m.score * 10) : null,
    format: J_FORMAT[m.type] || null,
    year: m.year || (from && from.year) || null,
    status: J_STATUS[m.status] || null,
    episodes: m.episodes || null,
    duration: parseInt(m.duration, 10) || null,
    genres: (m.genres || []).map((g) => g.name),
    studios: (m.studios || []).map((s) => s.name),
    description: clean(m.synopsis),
    trailer: m.trailer && m.trailer.youtube_id ? { site: 'youtube', id: m.trailer.youtube_id } : null,
  }
}

const dedupe = (list) => { const seen = new Set(); return list.filter((c) => (seen.has(c.malId) ? false : seen.add(c.malId))) }
const jList = async (path, signal) => {
  const j = await jikan(path, signal)
  return { results: dedupe((j.data || []).map(fromJikan)), hasNext: !!(j.pagination && j.pagination.has_next_page) }
}

const jRails = async (signal) => {
  // sequential on purpose: the queue enforces Jikan's rate limit
  const trending = await jList('/top/anime?filter=airing&limit=20&sfw=true', signal)
  const season = await jList('/seasons/now?limit=20&sfw=true', signal)
  const popular = await jList('/top/anime?filter=bypopularity&limit=20&sfw=true', signal)
  const top = await jList('/top/anime?limit=20&sfw=true', signal)
  const movies = await jList('/top/anime?type=movie&limit=20&sfw=true', signal)
  return { trending: trending.results, season: season.results, popular: popular.results, top: top.results, movies: movies.results }
}

// NOTE: genre filtering is intentionally skipped on Jikan (it needs MAL genre ids); the UI already warns about this.
const jSearch = ({ q, format, sort, page }, signal) =>
  jList('/anime?' + qs({ q, page: page || 1, limit: 24, sfw: true, type: J_TYPE_REV[format] || '', ...(J_SORT[sort] || {}) }), signal)

const jAnime = async ({ mal }, signal) => {
  if (!mal) throw new Error('Jikan needs a MyAnimeList id')
  const [full, recs] = await Promise.all([
    jikan(`/anime/${mal}/full`, signal),
    jikan(`/anime/${mal}/recommendations`, signal).catch((e) => { if (aborted(signal)) throw abortErr(); return { data: [] } }),
  ])
  return {
    ...fromJikan(full.data),
    recommendations: dedupe((recs.data || []).slice(0, 12).map((r) => fromJikan(r.entry || {})).filter((c) => c.malId)),
  }
}

async function jikanEpisodes(mal, signal) {
  const items = []
  for (let p = 1; p <= 3; p++) { // up to 300 episodes
    const j = await jikan(`/anime/${mal}/episodes?page=${p}`, signal)
    for (const e of j.data || []) {
      items.push({ number: e.mal_id, title: e.title || '', airdate: e.aired ? String(e.aired).slice(0, 10) : '', filler: !!e.filler })
    }
    if (!(j.pagination && j.pagination.has_next_page)) break
  }
  return { items, total: items.length }
}

// ═════════════════════════════════════════════════════════════════════════════
// Public API (same names/shapes the pages already use)
// ═════════════════════════════════════════════════════════════════════════════
export const api = {
  async home(signal) {
    return cached('home:' + getSource(), 10 * MIN, async () => {
      const [provider, rails] = await chain(
        sources(() => alRails(signal), () => kRails(signal), () => yume.home(signal), () => jRails(signal)), signal)
      if (!Object.values(rails).some((l) => l && l.length)) throw new Error('No anime returned')
      return { rails, provider }
    })
  },

  async search(p, signal) {
    const key = 'search:' + getSource() + JSON.stringify([p.q || '', p.genre || '', p.format || '', p.sort || '', p.page || 1])
    return cached(key, 10 * MIN, async () => {
      const [provider, d] = await chain(
        sources(() => alSearch(p, signal), () => kSearch(p, signal), () => yume.search(p, signal), () => jSearch(p, signal)), signal)
      return { ...d, provider }
    })
  },

  async anime({ id, mal }, signal) {
    return cached('anime:' + getSource() + ':' + (id || '') + ':' + (mal || ''), 30 * MIN, async () => {
      const [provider, a] = await chain(
        sources(() => alAnime({ id, mal }, signal), () => kAnime({ id, mal }, signal), () => yume.anime({ id, mal }, signal), () => jAnime({ mal }, signal)), signal)
      return { ...a, provider }
    })
  },

  /**
   * Episode list for an anime card. Counts come from AniList; titles/thumbnails/air dates are layered on
   * from Kitsu, then Jikan, then AniList's own streamingEpisodes. Never fails: worst case is "Episode N".
   * Returns { episodes: [{number,title,thumbnail,airdate,description,filler}], total }
   */
  async episodes(a, signal) {
    return cached('ep:' + getSource() + ':' + (a.id || '') + ':' + (a.malId || ''), 15 * MIN, async () => {
      const meta = new Map()
      const put = (n, patch) => {
        if (!n) return
        const cur = meta.get(n) || {}
        for (const [k, v] of Object.entries(patch)) if (v && !cur[k]) cur[k] = v
        meta.set(n, cur)
      }
      let kTotal = 0
      let jTotal = 0
      let yTotal = 0

      const viaKitsu = async () => {
        try {
          const k = await kitsuEpisodes(a, signal)
          k.items.forEach((e) => put(e.number, e))
          kTotal = k.total
        } catch (e) { if (aborted(signal)) throw abortErr() }
      }
      const viaJikan = async () => {
        if (!a.malId) return
        try {
          const j = await jikanEpisodes(a.malId, signal)
          j.items.forEach((e) => put(e.number, e))
          jTotal = j.total
        } catch (e) { if (aborted(signal)) throw abortErr() }
      }
      const viaYume = async () => {
        if (!yume.enabled || !(a.id || a.malId || a.yumeId)) return
        try {
          const y = await yume.episodes(a, signal)
          y.items.forEach((e) => put(e.number, e))
          yTotal = y.total
        } catch (e) { if (aborted(signal)) throw abortErr() }
      }
      const pref = getSource()
      if (pref === 'yumelist') { // user prefers YumeList → it goes first, the others fill gaps
        await viaYume()
        if (meta.size < 3) await viaKitsu()
        if (meta.size < 3) await viaJikan()
      } else if (pref === 'jikan') { // MyAnimeList data first
        await viaJikan()
        if (meta.size < 3) await viaKitsu()
        if (meta.size < 3) await viaYume()
      } else { // default: Kitsu → Jikan → YumeList (each only if the previous had little/nothing)
        await viaKitsu()
        if (meta.size < 3) await viaJikan()
        if (meta.size < 3) await viaYume()
      }

      for (const se of a.streamingEpisodes || []) { // AniList's licensed-stream episode titles (lowest priority)
        const m = /(?:episode|ep\.?)\s*(\d+)/i.exec(se.title || '')
        if (m) put(parseInt(m[1], 10), { title: se.title.replace(/^.*?\d+\s*[-–:]\s*/, ''), thumbnail: se.thumbnail })
      }

      // How many episodes exist *right now*?
      let n
      if (a.status === 'NOT_YET_RELEASED') n = 0
      else if (a.status === 'RELEASING' && a.nextAiring && a.nextAiring.episode) n = a.nextAiring.episode - 1
      else n = a.episodes || kTotal || jTotal || yTotal || Math.max(0, ...meta.keys())

      const episodes = Array.from({ length: n }, (_, i) => {
        const num = i + 1
        const m = meta.get(num) || {}
        return { number: num, title: m.title || 'Episode ' + num, thumbnail: m.thumbnail || null, airdate: m.airdate || '', description: m.description || '', filler: !!m.filler }
      })
      return { episodes, total: episodes.length }
    })
  },
}

// ── links ────────────────────────────────────────────────────────────────────
export const animeHref = (a) => (a.id ? '/anime/?id=' + a.id : '/anime/?mal=' + a.malId)
export const watchHref = (id, ep, lang, mal) => '/watch/?' + qs({ id, mal, ep, lang: lang || 'sub' })

// ── "continue watching" ───────────────────────────────────────────────────────
// Always cached in this browser (works signed-out). When signed in, AuthProvider mirrors it to the account
// (Realtime Database users/<uid>/history) through setHistoryHook / replaceHistory below.
const KEY = 'thy_history_v1'
const MAX_HISTORY = 20
const hkey = (x) => x.id || 'm' + x.mal
/** Stable Firebase-safe key for a history entry. */
export const histKey = (x) => (x.id ? 'a' + x.id : 'm' + x.mal)
let historyHook = null
export function setHistoryHook(fn) { historyHook = fn }
const announce = () => { try { window.dispatchEvent(new Event('thy-history')) } catch (e) {} }

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch (e) { return [] }
}
function writeHistory(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_HISTORY))) } catch (e) {}
}
export function pushHistory(item) {
  try {
    const entry = JSON.parse(JSON.stringify({ ...item, at: Date.now() })) // drops undefined (Firebase rejects it)
    const list = getHistory().filter((x) => hkey(x) !== hkey(entry))
    list.unshift(entry)
    const kept = list.slice(0, MAX_HISTORY)
    writeHistory(kept)
    announce()
    if (historyHook) historyHook(entry, kept)
  } catch (e) {}
}
/** Replace the local list (used when account data arrives or is merged). */
export function replaceHistory(list) {
  const sorted = [...list].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, MAX_HISTORY)
  writeHistory(sorted)
  announce()
  return sorted
}
export function clearLocalHistory() {
  try { localStorage.removeItem(KEY) } catch (e) {}
  announce()
}
export function getLang() {
  try { return localStorage.getItem('thy_lang') === 'dub' ? 'dub' : 'sub' } catch (e) { return 'sub' }
}
export function setLang(l) { try { localStorage.setItem('thy_lang', l) } catch (e) {} }

export const GENRES = ['Action','Adventure','Comedy','Drama','Ecchi','Fantasy','Horror','Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller']
export const STATUS_LABEL = { RELEASING: 'Airing', FINISHED: 'Finished', NOT_YET_RELEASED: 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'Hiatus' }

/**
 * True when a title is a movie / one-shot with a single episode — the UI then hides the episode list and Prev/Next.
 * A show that is still airing and only has 1 episode out so far is NOT single (more are coming), unless its announced total is 1.
 */
export function isSingleEpisode(a, eps) {
  if (!a) return false
  if (a.format === 'MOVIE') return true
  if (a.episodes === 1) return true
  if (a.episodes > 1) return false // known multi-episode show, even if its list came back short
  if (a.status === 'RELEASING' || a.status === 'NOT_YET_RELEASED') return false
  return a.status === 'FINISHED' && Array.isArray(eps) && eps.length === 1
}
/** Label for the single episode: "Movie", "OVA", "Special"… */
export const singleLabel = (a) => (a && a.format === 'MOVIE' ? 'Movie' : a && ['OVA', 'ONA', 'SPECIAL'].includes(a.format) ? a.format.charAt(0) + a.format.slice(1).toLowerCase() : 'Episode 1')
