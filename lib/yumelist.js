// ─────────────────────────────────────────────────────────────────────────────
// YumeList metadata slot — DISABLED by default.
//
// I could not find public API documentation for YumeList, so this file does not guess at endpoints.
// To turn it on:
//   1. Set NEXT_PUBLIC_YUMELIST_API=https://<yumelist api base> at build time.
//   2. Fill in the three functions below. Each must return data in the SAME shape the other
//      providers return (see fromAniList / fromKitsu / fromJikan in lib/api.js):
//        card   = { id (AniList id|null), malId, title, cover, banner, score (0-100), format, year, status, episodes, ... }
//        home   → { trending, season, popular, top, movies }  (arrays of cards)
//        search → { results: [card], hasNext: boolean }
//        anime  → card (+ description, genres, studios, ...)
//   3. Anything you throw is caught; the site simply moves on to the next provider (Jikan).
//
// If your Python server already talks to YumeList, `grep -ri yumelist` in it shows the exact URLs.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (process.env.NEXT_PUBLIC_YUMELIST_API || '').replace(/\/+$/, '')
const todo = () => Promise.reject(new Error('YumeList adapter not implemented (see lib/yumelist.js)'))

export const yume = {
  enabled: !!BASE,
  base: BASE,
  home: (signal) => todo(),
  search: (params, signal) => todo(),
  anime: (ids, signal) => todo(),
}
