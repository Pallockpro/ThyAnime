'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// /lockemup — just plays the video. No button anywhere on the site points here (it's a meme page).
// The player is rendered straight into <body> (outside the site layout) with inline styles, and every other
// part of the site is hidden while it is open, so nothing can sit on top of / behind / around the video.
const SRC = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/lockemup.mp4'

const FILL = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 2147483000 }

export default function LockEmUp() {
  const v = useRef(null)
  const [mounted, setMounted] = useState(false)
  const [blocked, setBlocked] = useState(false) // browser refused autoplay-with-sound
  const [problem, setProblem] = useState('')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const el = v.current
    if (!el) return
    const p = el.play()
    if (p && p.catch) p.catch(() => setBlocked(true))
  }, [mounted])

  if (!mounted) return null

  const start = () => {
    const el = v.current
    if (!el) return
    el.muted = false
    el.play().then(() => setBlocked(false)).catch(() => {})
  }
  const onMeta = (e) => {
    // audio-only decode = the browser couldn't decode the picture
    if (e.currentTarget.videoWidth === 0) setProblem('Your browser could not decode the video track. Try Chrome, Edge or Firefox.')
  }

  return createPortal(
    <div data-lockemup style={FILL}>
      <style>{`body > *:not([data-lockemup]) { display: none !important; } html, body { background: #000 !important; overflow: hidden !important; }`}</style>
      <video
        ref={v} src={SRC} controls autoPlay loop playsInline preload="auto"
        onLoadedMetadata={onMeta}
        onError={() => setProblem('The video file failed to load.')}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
      />
      {blocked ? (
        <button onClick={start}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 22, fontWeight: 600, border: 0, cursor: 'pointer' }}>
          Tap to play ▶
        </button>
      ) : null}
      {problem ? (
        <p style={{ position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center', color: '#fca5a5', fontSize: 14, padding: '0 16px' }}>{problem}</p>
      ) : null}
    </div>,
    document.body
  )
}
