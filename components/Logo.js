import { useId } from 'react'

// The ThyAnime logo: a glossy slime droplet with a play button and a sparkle.
// Its colours follow the site theme (Slime = cyan/blue, OG = pink) through the CSS variables in app/globals.css.
// For the tab icon see lib/logo-data.js (generated from the same artwork).
export default function Logo({ size = 28, className = '', title, sparkle = true, bubbles = true }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = 'tlg' + uid, s = 'tls' + uid
  const body = 'M32 3C32 3 53 24.5 53 40.5C53 52.4 43.7 61 32 61S11 52.4 11 40.5C11 24.5 32 3 32 3Z'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className}
      role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true} focusable="false">
      <defs>
        <linearGradient id={g} x1="16" y1="6" x2="50" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'rgb(var(--b300))' }} />
          <stop offset=".48" style={{ stopColor: 'rgb(var(--b500))' }} />
          <stop offset="1" style={{ stopColor: 'rgb(var(--b600))' }} />
        </linearGradient>
        <linearGradient id={s} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={body} fill={'url(#' + g + ')'} />
      <path d={body} fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="1.4" />
      <path d="M17.5 41C17.5 33.5 21.5 26.5 27.5 18.2C24.8 26.4 24.9 32.6 27.6 37.5C23.4 37.6 20 38.8 17.5 41Z" fill={'url(#' + s + ')'} />
      <path d="M27.3 31.6v17.4c0 1.3 1.4 2 2.5 1.4l14.6-8.7c1-.6 1-2.1 0-2.7l-14.6-8.7c-1.1-.6-2.5.1-2.5 1.3Z" fill="#fff" />
      {sparkle ? <path d="M50.5 5.5l1.7 5.6 5.6 1.7-5.6 1.7-1.7 5.6-1.7-5.6-5.6-1.7 5.6-1.7Z" fill="#fff" /> : null}
      {bubbles ? (
        <>
          <circle cx="11.5" cy="15" r="2.3" style={{ fill: 'rgb(var(--b300))' }} opacity=".85" />
          <circle cx="6.5" cy="23.5" r="1.3" style={{ fill: 'rgb(var(--b300))' }} opacity=".6" />
        </>
      ) : null}
    </svg>
  )
}
