// ─────────────────────────────────────────────────────────────────────────────
// Streaming servers. Every server is just an iframe URL template, so the site
// needs no backend. Placeholders: {id} · {ep} · {lang} (sub|dub)
//
// Each server has up to two templates:
//   ani → {id} is the AniList id (preferred)     mal → {id} is the MyAnimeList id (used when AniList id is unknown)
//
// Edit the templates below (or override with NEXT_PUBLIC_* env vars at build time).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_THY = 'https://api.thyanime.me'
const isOff = (v) => ['', 'off', 'none', '0', 'false'].includes(String(v).trim().toLowerCase())
const strip = (s) => String(s).trim().replace(/\/+$/, '')

// Your own ThyAnime server — OPTIONAL. Set NEXT_PUBLIC_THY_SERVER=off to remove it entirely.
const thyRaw = process.env.NEXT_PUBLIC_THY_SERVER
const THY = thyRaw === undefined ? DEFAULT_THY : isOff(thyRaw) ? '' : strip(thyRaw)

const ALL = [
  {
    key: 'megaplay',
    name: 'MegaPlay',
    // Verified against https://megaplay.buzz/api
    ani: 'https://megaplay.buzz/stream/ani/{id}/{ep}/{lang}',
    mal: 'https://megaplay.buzz/stream/mal/{id}/{ep}/{lang}',
  },
  {
    key: 'filmu',
    name: 'FilmU',
    // ⚠ UNVERIFIED path. embed.filmu.in now redirects to vidly.pro and its anime route could not be
    // confirmed. Open https://embed.filmu.in → "Anime" tab, copy the example URL, and put it here with
    // {id} {ep} {lang} in place of the numbers (or set NEXT_PUBLIC_FILMU_ANI at build time).
    ani: process.env.NEXT_PUBLIC_FILMU_ANI || 'https://embed.filmu.in/anime/{id}/{ep}/{lang}',
    mal: process.env.NEXT_PUBLIC_FILMU_MAL || '',
  },
  {
    key: 'megavid',
    name: 'MegaVid',
    // Verified against https://megavid.buzz (Docs → Usage). Routes: /ani/{anilist}/{ep}/{sub|dub} and /mal/{mal}/{ep}/{sub|dub}.
    ani: 'https://megavid.buzz/ani/{id}/{ep}/{lang}',
    mal: 'https://megavid.buzz/mal/{id}/{ep}/{lang}',
  },
  {
    key: 'anixo',
    name: 'Anixo',
    // Verified against https://anixo.buzz (Developer Integration). Audio is a query param: track=sub|dub.
    // Has automatic server failover built in (Sora → Zozo).
    ani: 'https://anixo.buzz/embed/ani/{id}/{ep}?track={lang}',
    mal: 'https://anixo.buzz/embed/mal/{id}/{ep}?track={lang}',
  },
  THY
    ? {
        key: 'thy',
        name: 'ThyAnime',
        own: true,
        ani: THY + '/embed/{id}/{ep}/{lang}', // your Python server only understands AniList ids
        mal: '',
        probe: THY + '/status', // used only to grey the button out when your server is down
      }
    : null,
]

export const SERVERS = ALL.filter(Boolean).filter((s) => s.ani || s.mal)

const fill = (tpl, id, ep, lang) =>
  tpl.replace('{id}', encodeURIComponent(id)).replace('{ep}', encodeURIComponent(ep)).replace('{lang}', lang === 'dub' ? 'dub' : 'sub')

/** Iframe URL for a server, or null if it can't play this title (e.g. no matching id). */
export function buildEmbed(server, { id, mal, ep, lang }) {
  if (server.ani && id) return fill(server.ani, id, ep, lang)
  if (server.mal && mal) return fill(server.mal, mal, ep, lang)
  return null
}

/**
 * Is a server reachable at all? A no-cors fetch resolves (opaque) on ANY HTTP response and
 * rejects only on network failure/timeout — exactly the "is it up" signal we need, no CORS required.
 */
export function probe(url, ms = 4000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  return fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ac.signal })
    .then(() => true, () => false)
    .finally(() => clearTimeout(t))
}

const SRV_KEY = 'thy_server'
export function getServer() {
  try { return localStorage.getItem(SRV_KEY) || '' } catch (e) { return '' }
}
export function setServer(k) {
  try { localStorage.setItem(SRV_KEY, k) } catch (e) {}
}

// Per-session pick made from the player's server buttons. It does NOT change your saved default (Settings page).
const SESS_KEY = 'thy_server_session'
export function getSessionServer() {
  try { return sessionStorage.getItem(SESS_KEY) || '' } catch (e) { return '' }
}
export function setSessionServer(k) {
  try { sessionStorage.setItem(SESS_KEY, k) } catch (e) {}
}
