'use client'
import { useEffect, useRef, useState } from 'react'

// /lockemup — just plays the video. No button anywhere on the site points here (it's a meme page).
// The overlay covers the navbar/footer so it is only the video.
const SRC = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/lockemup.mp4'

export default function LockEmUp() {
  const v = useRef(null)
  const [blocked, setBlocked] = useState(false) // browser refused autoplay-with-sound

  useEffect(() => {
    const el = v.current
    if (!el) return
    const p = el.play()
    if (p && p.catch) p.catch(() => setBlocked(true))
  }, [])

  const start = () => {
    const el = v.current
    if (!el) return
    el.muted = false
    el.play().then(() => setBlocked(false)).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black">
      <video ref={v} src={SRC} controls autoPlay loop playsInline preload="auto" className="h-full w-full object-contain" />
      {blocked ? (
        <button onClick={start} className="absolute inset-0 flex items-center justify-center bg-black/70 text-xl font-semibold text-white">
          Tap to play ▶
        </button>
      ) : null}
    </div>
  )
}
