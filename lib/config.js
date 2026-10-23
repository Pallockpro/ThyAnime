// ─────────────────────────────────────────────────────────────────────────────
// Site-wide switches.
//
// MAINTENANCE MODE — three ways to control it:
//   1. (normal) Firebase console → Realtime Database → config/maintenance → enabled: true / false.
//      Takes effect for visitors within seconds, no redeploy. (See firebase/README.md)
//   2. (force-on)  Build variable NEXT_PUBLIC_MAINTENANCE=true (GitHub repo Variable MAINTENANCE=true).
//      Forces maintenance ON no matter what the database says — handy if Firebase itself is down.
//   3. Edit DEFAULT_MAINTENANCE below (text shown when the database has no title/message).
//
// BANNER — Firebase console → Realtime Database → config/banner → Text, Text2 … Text5 (strings), Visible + rotations (true/false).
//   Visible true → the bar is shown across the top of the site. Visible false → hidden. Live, no redeploy.
//   rotations false → only Text is shown.
//   rotations true  → Text, Text2, Text3 … take turns every 10 seconds (blank ones are skipped, then it loops).
//
// ADMINS see the real site while maintenance is on. Put Google emails in NEXT_PUBLIC_ADMIN_EMAILS
// (comma separated; GitHub repo Variable ADMIN_EMAILS) or in ADMIN_EMAILS_FALLBACK below.
// ─────────────────────────────────────────────────────────────────────────────

const truthy = (v) => ['1', 'true', 'on', 'yes'].includes(String(v == null ? '' : v).trim().toLowerCase())

export const MAINTENANCE_FORCED = truthy(process.env.NEXT_PUBLIC_MAINTENANCE)
export const MAINTENANCE_PATH = 'config/maintenance'
export const BANNER_PATH = 'config/banner'

// Case-insensitive field lookup so `Text` / `text` / `Visible` / `visible` / `Enabled` / `enabled` all work in the console.
const pick = (o, name) => {
  if (!o || typeof o !== 'object') return undefined
  const k = Object.keys(o).find((x) => x.toLowerCase() === name)
  return k === undefined ? undefined : o[k]
}

export const DEFAULT_MAINTENANCE = {
  enabled: false,
  title: 'We’ll be right back',
  message: 'ThyAnime is down for maintenance. Please check back in a little while.',
  eta: '',
}

const ADMIN_EMAILS_FALLBACK = [] // e.g. ['you@gmail.com']
export const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .concat(ADMIN_EMAILS_FALLBACK)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

/** Turn whatever is stored in the database (object, or just true/false) into a clean maintenance object. */
export function normalizeMaintenance(v) {
  const base = { ...DEFAULT_MAINTENANCE }
  if (typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number') base.enabled = truthy(v)
  else if (v && typeof v === 'object') {
    base.enabled = truthy(pick(v, 'enabled'))
    const title = pick(v, 'title'), message = pick(v, 'message'), eta = pick(v, 'eta')
    if (title) base.title = String(title)
    if (message) base.message = String(message)
    if (eta) base.eta = String(eta)
  }
  if (MAINTENANCE_FORCED) base.enabled = true
  return base
}

/**
 * Site banner — Firebase console → Realtime Database → config/banner:
 *   Text, Text2, Text3, Text4, Text5 …  the messages        Visible: true / false      rotations: true / false
 * Returns { visible, rotations, items, text }:
 *   rotations false → items = [Text]  (only the one with no number)
 *   rotations true  → items = every non-blank Text / Text2 / Text3 … in order (blank ones are skipped)
 * It only shows when Visible is true AND there is at least one message to show.
 */
export const BANNER_ROTATE_MS = 10000

export function normalizeBanner(v) {
  const none = { visible: false, rotations: false, items: [], text: '' }
  if (!v || typeof v !== 'object') return none
  const clean = (x) => String(x == null ? '' : x).trim()
  const rotations = truthy(pick(v, 'rotations'))
  let items
  if (rotations) {
    // Text, Text2, Text3 … (any number of them), in numeric order; "Text" counts as 1
    items = Object.keys(v)
      .map((k) => { const m = /^text(\d*)$/i.exec(k); return m ? { n: m[1] === '' ? 1 : parseInt(m[1], 10), t: clean(v[k]) } : null })
      .filter((x) => x && x.t.length > 0)
      .sort((a, b) => a.n - b.n)
      .map((x) => x.t)
  } else {
    const t = clean(pick(v, 'text'))
    items = t ? [t] : []
  }
  return { visible: truthy(pick(v, 'visible')) && items.length > 0, rotations, items, text: items[0] || '' }
}
