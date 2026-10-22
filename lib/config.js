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
// ADMINS see the real site while maintenance is on. Put Google emails in NEXT_PUBLIC_ADMIN_EMAILS
// (comma separated; GitHub repo Variable ADMIN_EMAILS) or in ADMIN_EMAILS_FALLBACK below.
// ─────────────────────────────────────────────────────────────────────────────

const truthy = (v) => ['1', 'true', 'on', 'yes'].includes(String(v == null ? '' : v).trim().toLowerCase())

export const MAINTENANCE_FORCED = truthy(process.env.NEXT_PUBLIC_MAINTENANCE)
export const MAINTENANCE_PATH = 'config/maintenance'

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
    base.enabled = truthy(v.enabled)
    if (v.title) base.title = String(v.title)
    if (v.message) base.message = String(v.message)
    if (v.eta) base.eta = String(v.eta)
  }
  if (MAINTENANCE_FORCED) base.enabled = true
  return base
}
