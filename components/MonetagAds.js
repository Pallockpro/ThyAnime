'use client'
import { useEffect } from 'react'

// Monetag ad tags. Mounted once in app/layout.js, so they load on EVERY page
// (home, anime, watch, search...) and never get injected twice.
const TAGS = [
  { id: 'monetag-tag-1', zone: '12194696', src: 'https://nap5k.com/tag.min.js' },
  { id: 'monetag-tag-2', zone: '11194022', src: 'https://al5sm.com/tag.min.js' },
]

export default function MonetagAds() {
  useEffect(() => {
    TAGS.forEach((t) => {
      if (document.getElementById(t.id)) return
      const s = document.createElement('script')
      s.id = t.id
      s.dataset.zone = t.zone
      s.src = t.src
      s.async = true
      ;(document.body || document.documentElement).appendChild(s)
    })
  }, [])
  return null
}
