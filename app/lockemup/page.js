'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Maximize, Minimize, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { MEME_FLAG } from '../../components/MemeToast'

// /lockemup — hidden meme page with its own custom video player (themed controls, no browser UI).
// Rendered straight into <body> with every other part of the site hidden, so nothing can cover the video.
// Leaving this page (Back button OR the browser's back button) makes the home page show a short "just a meme" notice.
const SRC = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/lockemup.mp4'
const ACC = 'rgb(var(--b500, 79 213 255))'

const CSS = `
body > *:not([data-lockemup]) { display: none !important; }
html, body { background: #000 !important; overflow: hidden !important; }
.lk-root { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; height: 100dvh; background: #000; z-index: 2147483000; user-select: none; -webkit-user-select: none; font-family: system-ui, sans-serif; color: #fff; }
.lk-root video { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }
.lk-ui { position: absolute; left: 0; right: 0; transition: opacity .25s ease; }
.lk-ui.lk-hide { opacity: 0; pointer-events: none; }
.lk-top { top: 0; padding: 14px 16px 40px; background: linear-gradient(to bottom, rgba(0,0,0,.75), transparent); }
.lk-bottom { bottom: 0; padding: 40px 16px 12px; background: linear-gradient(to top, rgba(0,0,0,.85), transparent); }
.lk-pill { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px 9px 12px; border-radius: 999px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s, transform .15s; }
.lk-pill:hover { background: ${ACC}; transform: translateX(-2px); }
.lk-btn { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 999px; background: transparent; border: 0; color: #fff; cursor: pointer; transition: background .15s, color .15s; }
.lk-btn:hover { background: rgba(255,255,255,.14); color: ${ACC}; }
.lk-seek { position: relative; height: 18px; cursor: pointer; touch-action: none; display: flex; align-items: center; }
.lk-track { position: relative; width: 100%; height: 4px; border-radius: 4px; background: rgba(255,255,255,.22); transition: height .12s; }
.lk-seek:hover .lk-track, .lk-seek.lk-drag .lk-track { height: 7px; }
.lk-buf { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: rgba(255,255,255,.28); }
.lk-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: ${ACC}; }
.lk-knob { position: absolute; top: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px ${ACC}; transform: translateY(-50%) scale(0); transition: transform .12s; }
.lk-seek:hover .lk-knob, .lk-seek.lk-drag .lk-knob { transform: translateY(-50%) scale(1); }
.lk-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.lk-time { font-size: 13px; font-variant-numeric: tabular-nums; margin-left: 8px; color: #e4e4e7; white-space: nowrap; }
.lk-vol { width: 84px; margin-left: 2px; accent-color: ${ACC}; cursor: pointer; }
.lk-spacer { flex: 1; }
.lk-big { position: absolute; top: 50%; left: 50%; width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 50%; background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.25); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; color: #fff; pointer-events: none; animation: lkpop .25s ease; box-shadow: 0 0 40px ${ACC}; }
.lk-spin { position: absolute; top: 50%; left: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; border: 4px solid rgba(255,255,255,.2); border-top-color: ${ACC}; animation: lkspin .8s linear infinite; pointer-events: none; }
@keyframes lkspin { to { transform: rotate(360deg); } }
@keyframes lkpop { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
@media (max-width: 560px) { .lk-vol { display: none; } }
`

const fmt = (t) => {
  if (!isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60), s = Math.floor(t % 60)
  return m + ':' + String(s).padStart(2, '0')
}

export default function LockEmUp() {
  const router = useRouter()
  const root = useRef(null)
  const v = useRef(null)
  const seek = useRef(null)
  const hideT = useRef(null)
  const dragging = useRef(false)

  const [mounted, setMounted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [buf, setBuf] = useState(0)
  const [vol, setVol] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fs, setFs] = useState(false)
  const [ui, setUi] = useState(true)
  const [wait, setWait] = useState(true)
  const [scrub, setScrub] = useState(null)   // 0..1 while dragging the seek bar
  const [blocked, setBlocked] = useState(false) // browser refused autoplay-with-sound
  const [problem, setProblem] = useState('')

  useEffect(() => { setMounted(true) }, [])

  // browser Back button also counts as "going back" → home page shows the meme notice
  useEffect(() => {
    const flag = () => { try { sessionStorage.setItem(MEME_FLAG, '1') } catch (e) {} }
    window.addEventListener('popstate', flag)
    return () => window.removeEventListener('popstate', flag)
  }, [])

  const poke = useCallback(() => {
    setUi(true)
    clearTimeout(hideT.current)
    hideT.current = setTimeout(() => { if (v.current && !v.current.paused && !dragging.current) setUi(false) }, 2800)
  }, [])
  useEffect(() => () => clearTimeout(hideT.current), [])

  useEffect(() => {
    if (!mounted) return
    const el = v.current
    if (!el) return
    const p = el.play()
    if (p && p.catch) p.catch(() => setBlocked(true))
  }, [mounted])

  const toggle = useCallback(() => {
    const el = v.current
    if (!el) return
    if (el.paused) el.play().catch(() => {}); else el.pause()
  }, [])
  const toggleMute = useCallback(() => { const el = v.current; if (el) { el.muted = !el.muted; if (!el.muted && el.volume === 0) el.volume = 0.5 } }, [])
  const toggleFs = useCallback(() => {
    const r = root.current, el = v.current
    if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); return }
    if (r && r.requestFullscreen) r.requestFullscreen().catch(() => {})
    else if (el && el.webkitEnterFullscreen) el.webkitEnterFullscreen() // iPhone Safari
  }, [])
  const skip = useCallback((d) => { const el = v.current; if (el && el.duration) el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + d)) }, [])
  const goBack = () => {
    try { sessionStorage.setItem(MEME_FLAG, '1') } catch (e) {}
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {})
    router.push('/')
  }

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => { document.removeEventListener('fullscreenchange', onFs); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}) }
  }, [])

  // keyboard: space/k play, ←/→ ±5s (j/l ±10s), ↑/↓ volume, m mute, f fullscreen
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && e.target.tagName === 'INPUT') return
      const el = v.current
      if (!el || e.ctrlKey || e.metaKey || e.altKey) return
      let used = true
      switch (e.key) {
        case ' ': case 'k': case 'K': toggle(); break
        case 'ArrowLeft': skip(-5); break
        case 'ArrowRight': skip(5); break
        case 'j': case 'J': skip(-10); break
        case 'l': case 'L': skip(10); break
        case 'ArrowUp': el.muted = false; el.volume = Math.min(1, el.volume + 0.1); break
        case 'ArrowDown': el.volume = Math.max(0, el.volume - 0.1); break
        case 'm': case 'M': toggleMute(); break
        case 'f': case 'F': toggleFs(); break
        default: used = false
      }
      if (used) { e.preventDefault(); poke() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, skip, toggleMute, toggleFs, poke])

  if (!mounted) return null

  const ratio = (e) => {
    const r = seek.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const seekDown = (e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setScrub(ratio(e)); setUi(true) }
  const seekMove = (e) => { if (dragging.current) setScrub(ratio(e)) }
  const seekUp = (e) => {
    if (!dragging.current) return
    dragging.current = false
    const el = v.current
    if (el && el.duration) el.currentTime = ratio(e) * el.duration
    setScrub(null); poke()
  }

  const onMeta = (e) => {
    setDur(e.currentTarget.duration || 0)
    if (e.currentTarget.videoWidth === 0) setProblem('Your browser could not decode the video track. Try Chrome, Edge or Firefox.')
  }
  const onProgress = (e) => {
    const el = e.currentTarget
    for (let i = 0; i < el.buffered.length; i++) {
      if (el.buffered.start(i) <= el.currentTime && el.currentTime <= el.buffered.end(i)) { setBuf(el.buffered.end(i)); return }
    }
  }
  const pct = (dur ? (scrub !== null ? scrub : cur / dur) : 0) * 100
  const shownTime = scrub !== null ? scrub * dur : cur
  const VolIcon = muted || vol === 0 ? VolumeX : vol < 0.5 ? Volume1 : Volume2

  return createPortal(
    <div data-lockemup ref={root} className="lk-root" onMouseMove={poke} onTouchStart={poke}
      style={{ cursor: ui || !playing ? 'default' : 'none' }}>
      <style>{CSS}</style>
      <video
        ref={v} src={SRC} autoPlay loop playsInline preload="auto"
        onClick={toggle} onDoubleClick={toggleFs}
        onLoadedMetadata={onMeta}
        onTimeUpdate={(e) => { if (!dragging.current) setCur(e.currentTarget.currentTime); onProgress(e) }}
        onProgress={onProgress}
        onDurationChange={(e) => setDur(e.currentTarget.duration || 0)}
        onPlay={() => { setPlaying(true); setBlocked(false); poke() }}
        onPause={() => { setPlaying(false); setUi(true) }}
        onWaiting={() => setWait(true)}
        onCanPlay={() => setWait(false)}
        onPlaying={() => setWait(false)}
        onVolumeChange={(e) => { setVol(e.currentTarget.volume); setMuted(e.currentTarget.muted) }}
        onError={() => setProblem('The video file failed to load.')}
      />

      {wait && !problem ? <div className="lk-spin" /> : null}
      {!playing && !wait && !blocked ? <div className="lk-big"><Play size={38} fill="#fff" style={{ marginLeft: 4 }} /></div> : null}

      <div className={'lk-ui lk-top' + (ui ? '' : ' lk-hide')}>
        <button className="lk-pill" onClick={goBack}><ArrowLeft size={18} /> Back to home</button>
      </div>

      <div className={'lk-ui lk-bottom' + (ui ? '' : ' lk-hide')} onClick={(e) => e.stopPropagation()}>
        <div ref={seek} className={'lk-seek' + (scrub !== null ? ' lk-drag' : '')}
          onPointerDown={seekDown} onPointerMove={seekMove} onPointerUp={seekUp} onPointerCancel={seekUp}>
          <div className="lk-track">
            <div className="lk-buf" style={{ width: (dur ? (buf / dur) * 100 : 0) + '%' }} />
            <div className="lk-fill" style={{ width: pct + '%' }} />
            <div className="lk-knob" style={{ left: pct + '%' }} />
          </div>
        </div>
        <div className="lk-row">
          <button className="lk-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button className="lk-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}><VolIcon size={21} /></button>
          <input className="lk-vol" type="range" min="0" max="1" step="0.02" value={muted ? 0 : vol} aria-label="Volume"
            onChange={(e) => { const el = v.current; el.muted = false; el.volume = parseFloat(e.target.value) }} />
          <span className="lk-time">{fmt(shownTime)} / {fmt(dur)}</span>
          <span className="lk-spacer" />
          <button className="lk-btn" onClick={toggleFs} aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'}>{fs ? <Minimize size={21} /> : <Maximize size={21} />}</button>
        </div>
      </div>

      {blocked ? (
        <button onClick={() => { const el = v.current; if (el) { el.muted = false; el.play().then(() => setBlocked(false)).catch(() => {}) } }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 22, fontWeight: 600, border: 0, cursor: 'pointer' }}>
          Tap to play ▶
        </button>
      ) : null}
      {problem ? (
        <p style={{ position: 'absolute', left: 0, right: 0, bottom: 90, textAlign: 'center', color: '#fca5a5', fontSize: 14, padding: '0 16px' }}>{problem}</p>
      ) : null}
    </div>,
    document.body
  )
}
