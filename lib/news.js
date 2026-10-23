// ─────────────────────────────────────────────────────────────────────────────
// News data — airing schedule + upcoming anime, straight from AniList (client-side, no server needed).
// Results are cached in memory + sessionStorage so tab-switching never re-hits AniList (90 req/min limit).
// ─────────────────────────────────────────────────────────────────────────────
const ANILIST = 'https://graphql.anilist.co'

async function gql(query, variables, signal, ms = 12000) {
  const ac = new AbortController()
  const onAbort = () => ac.abort()
  if (signal) { if (signal.aborted) ac.abort(); else signal.addEventListener('abort', onAbort) }
  const t = setTimeout(() => ac.abort(), ms)
  try {
    const r = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: ac.signal,
    })
    if (r.status === 429) throw new Error('AniList is rate-limiting requests — wait a minute and retry.')
    if (!r.ok) throw new Error('AniList returned HTTP ' + r.status)
    const j = await r.json()
    if (!j.data) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || 'AniList error')
    return j.data
  } finally {
    clearTimeout(t)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

const mem = new Map()
async function cached(key, ttl, fn) {
  const hit = mem.get(key)
  if (hit && hit.exp > Date.now()) return hit.v
  try {
    const raw = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('thy_n_' + key)
    if (raw) { const o = JSON.parse(raw); if (o.exp > Date.now()) { mem.set(key, o); return o.v } }
  } catch (e) {}
  const v = await fn()
  const o = { exp: Date.now() + ttl, v }
  mem.set(key, o)
  try { sessionStorage.setItem('thy_n_' + key, JSON.stringify(o)) } catch (e) {}
  return v
}

const card = (m) => {
  const t = m.title || {}
  return {
    id: m.id,
    malId: m.idMal || null,
    title: t.english || t.romaji || t.native || 'Untitled',
    romaji: t.romaji || null,
    cover: m.coverImage ? m.coverImage.large || m.coverImage.extraLarge : null,
    color: m.coverImage ? m.coverImage.color : null,
    score: m.averageScore || null,
    format: m.format || null,
    status: m.status || null,
    episodes: m.episodes || null,
    year: m.seasonYear || (m.startDate && m.startDate.year) || null,
    season: m.season || null,
    startDate: m.startDate || null,
    genres: m.genres || [],
    studio: ((m.studios && m.studios.nodes) || [])[0] ? m.studios.nodes[0].name : null,
    popularity: m.popularity || 0,
    country: m.countryOfOrigin || null,
    adult: !!m.isAdult,
  }
}

const MEDIA = `id idMal title { romaji english native } coverImage { large extraLarge color } averageScore format status season seasonYear startDate { year month day } episodes genres popularity countryOfOrigin isAdult studios(isMain: true) { nodes { name } }`

/**
 * Episodes airing between two unix timestamps (seconds). Pages through AniList (50/page, max `maxPages`).
 * desc=true → newest first (used for "Just aired").
 */
export async function airingBetween(from, to, { desc = false, maxPages = 6 } = {}, signal) {
  const key = 'air_' + Math.floor(from / 600) + '_' + Math.floor(to / 600) + (desc ? 'd' : 'a')
  return cached(key, 10 * 60 * 1000, async () => {
    const out = []
    for (let page = 1; page <= maxPages; page++) {
      const d = await gql(
        `query($from: Int, $to: Int, $page: Int, $sort: [AiringSort]) {
          Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: $sort) {
              airingAt episode
              media { ${MEDIA} }
            }
          }
        }`,
        { from, to, page, sort: [desc ? 'TIME_DESC' : 'TIME'] }, signal)
      for (const s of d.Page.airingSchedules) {
        if (!s.media || s.media.isAdult) continue
        out.push({ airingAt: s.airingAt, episode: s.episode, anime: card(s.media) })
      }
      if (!d.Page.pageInfo.hasNextPage) break
    }
    return out
  })
}

const fuzzy = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()

/**
 * Anime that haven't started airing yet.
 *   sort 'soon'    → closest release date first (only titles with a known start date)
 *   sort 'popular' → most anticipated first (includes titles with no date yet)
 */
export async function upcoming({ sort = 'popular', page = 1 } = {}, signal) {
  const today = fuzzy(new Date())
  return cached('up_' + sort + '_' + page + '_' + today, 30 * 60 * 1000, async () => {
    const d = await gql(
      `query($page: Int, $sort: [MediaSort], $after: FuzzyDateInt) {
        Page(page: $page, perPage: 24) {
          pageInfo { hasNextPage }
          media(type: ANIME, status: NOT_YET_RELEASED, sort: $sort, isAdult: false, startDate_greater: $after) { ${MEDIA} }
        }
      }`,
      { page, sort: [sort === 'soon' ? 'START_DATE' : 'POPULARITY_DESC'], after: sort === 'soon' ? today : undefined }, signal)
    return { results: d.Page.media.map(card), hasNext: !!d.Page.pageInfo.hasNextPage }
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SEASONS = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' }

/** "Jan 14, 2027" / "Jan 2027" / "Spring 2027" / "TBA" */
export function releaseLabel(a) {
  const s = a.startDate || {}
  if (s.year && s.month && s.day) return MONTHS[s.month - 1] + ' ' + s.day + ', ' + s.year
  if (s.year && s.month) return MONTHS[s.month - 1] + ' ' + s.year
  if (a.season && (a.year || s.year)) return SEASONS[a.season] + ' ' + (a.year || s.year)
  if (s.year) return String(s.year)
  return 'TBA'
}

/** Days until a (possibly partial) start date, or null if the day isn't known. */
export function daysUntil(a) {
  const s = a.startDate || {}
  if (!(s.year && s.month && s.day)) return null
  const t = new Date(s.year, s.month - 1, s.day).getTime()
  const n = new Date(); n.setHours(0, 0, 0, 0)
  return Math.round((t - n.getTime()) / 86400000)
}

/** "in 3h 12m" / "in 2d 4h" / "5m ago" */
export function countdown(unixSec, now = Date.now()) {
  const diff = unixSec * 1000 - now
  const abs = Math.abs(diff)
  const m = Math.floor(abs / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  const txt = d > 0 ? d + 'd ' + h + 'h' : h > 0 ? h + 'h ' + mm + 'm' : Math.max(mm, 1) + 'm'
  return diff >= 0 ? 'in ' + txt : txt + ' ago'
}
