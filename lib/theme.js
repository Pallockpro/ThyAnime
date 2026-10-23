// ─────────────────────────────────────────────────────────────────────────────
// Site colour themes.  The colours themselves live in app/globals.css as CSS variables:
//   :root                 → Slime theme (cyan + blue)  — the default
//   [data-theme="og"]     → OG site theme (the original pink + purple)
// The choice is saved in this browser (localStorage "thy_theme") and applied to <html data-theme="…">.
// ─────────────────────────────────────────────────────────────────────────────
export const THEMES = [
  { key: 'slime', name: 'Slime theme', note: 'Cyan & blue — the new default.', swatch: ['#4fd5ff', '#3b82f6'], bar: '#060e1a' },
  { key: 'og', name: 'OG site theme', note: 'The original pink & purple look.', swatch: ['#ff8fb8', '#8b5cf6'], bar: '#0b0710' },
]
export const DEFAULT_THEME = 'slime'
const KEY = 'thy_theme'

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'og' ? 'og' : DEFAULT_THEME } catch (e) { return DEFAULT_THEME }
}

export function applyTheme(key) {
  const t = THEMES.find((x) => x.key === key) || THEMES[0]
  document.documentElement.setAttribute('data-theme', t.key)
  const m = document.querySelector('meta[name="theme-color"]')
  if (m) m.setAttribute('content', t.bar)
}

export function setTheme(key) {
  const t = THEMES.find((x) => x.key === key) || THEMES[0]
  try { localStorage.setItem(KEY, t.key) } catch (e) {}
  applyTheme(t.key)
  return t.key
}

// Tiny script run before the first paint (see app/layout.js) so the page never flashes the wrong colours.
export const THEME_BOOT =
  "try{var t=localStorage.getItem('thy_theme')==='og'?'og':'slime';" +
  "document.documentElement.setAttribute('data-theme',t);" +
  "var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content',t==='og'?'#0b0710':'#060e1a')}" +
  "catch(e){document.documentElement.setAttribute('data-theme','slime')}"
