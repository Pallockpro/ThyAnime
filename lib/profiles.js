// Family accounts + profiles (Crunchyroll-style): one shared login, up to 5 profiles, each with its own history & settings.
//
// A family account is a normal Firebase email/password user whose "email" is  <username>@FAMILY_DOMAIN  (never mailed anything —
// it only exists so people can sign in with a plain username). Data lives in the Realtime Database:
//   families/{familyUid}/profiles/{profileId}   → { name, avatar, createdAt, primary?, google?, settings, history }
//   googleLinks/{googleUid}                     → { fam, pid }   (a Gmail linked to a profile → signs straight into it)

export const FAMILY_DOMAIN = 'family.thyanime.me'
export const MAX_PROFILES = 5
export const NAME_MAX = 20

// [emoji, colour] — the avatar picker (stored on the profile as its index, e.g. "3")
export const AVATARS = [
  ['🦊', '#f97316'], ['🐱', '#ec4899'], ['🐼', '#64748b'], ['🐸', '#22c55e'],
  ['🦉', '#a16207'], ['🐙', '#a855f7'], ['🐉', '#ef4444'], ['👻', '#6366f1'],
  ['🍙', '#f59e0b'], ['🌸', '#f472b6'], ['⭐', '#eab308'], ['🎧', '#06b6d4'],
  ['🐺', '#475569'], ['🦄', '#d946ef'], ['🍜', '#fb923c'], ['⚡', '#3b82f6'],
]
export const avatarOf = (k) => {
  const i = parseInt(k, 10)
  return AVATARS[Number.isFinite(i) ? Math.abs(i) % AVATARS.length : 0]
}

export const cleanUsername = (s) => String(s || '').trim().toLowerCase()
export const validUsername = (s) => /^[a-z0-9][a-z0-9._-]{2,19}$/.test(s)
export const familyEmail = (u) => cleanUsername(u) + '@' + FAMILY_DOMAIN
export const isFamilyEmail = (e) => !!e && String(e).toLowerCase().endsWith('@' + FAMILY_DOMAIN)
export const usernameOf = (e) => String(e || '').split('@')[0]
export const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
export const newPid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const PROFILE_KEY = 'thy_profile_'   // sessionStorage: which profile this browser session picked (so every new visit asks again)
export const FAMILY_HINT = 'thy_fam_hint'   // localStorage: "a family account was signed in" → show a splash instead of flashing the site
