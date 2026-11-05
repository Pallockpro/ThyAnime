'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Maximize, Minimize, Pause, Play, Settings, Volume1, Volume2, VolumeX } from 'lucide-react'
import { MEME_FLAG } from '../../components/MemeToast'

// /lockemup — hidden meme page with its own YouTube-style video player (red progress bar, flat white icons,
// tooltips, hover-to-expand volume slider, playback-speed menu). All styles are scoped to this page (.lk-*).
// Rendered straight into <body> with every other part of the site hidden, so nothing can cover the video.
// Leaving this page (Back button OR the browser's back button) makes the home page show a short "just a meme" notice.
const SRC = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/lockemup.mp4'
const RED = '#f00'
const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

const CSS = `
body > *:not([data-lockemup]) { display: none !important; }
html, body { background: #000 !important; overflow: hidden !important; }
.lk-root { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; height: 100dvh; background: #000; z-index: 2147483000; user-select: none; -webkit-user-select: none; font-family: Roboto, "YouTube Noto", Arial, system-ui, sans-serif; color: #fff; }
.lk-root video { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }
.lk-ui { position: absolute; left: 0; right: 0; transition: opacity .25s ease; }
.lk-ui.lk-hide { opacity: 0; pointer-events: none; }
.lk-top { top: 0; padding: 14px 16px 50px; background: linear-gradient(to bottom, rgba(0,0,0,.7), transparent); }
.lk-bottom { bottom: 0; padding: 60px 12px 6px; background: linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.4) 55%, transparent); }
.lk-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px 8px 10px; border-radius: 999px; background: rgba(0,0,0,.55); border: 0; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; }
.lk-pill:hover { background: rgba(255,255,255,.22); }

/* progress bar — thin, grows on hover, red played part, red knob */
.lk-seek { position: relative; height: 16px; cursor: pointer; touch-action: none; display: flex; align-items: flex-end; margin: 0 2px; }
.lk-track { position: relative; width: 100%; height: 3px; background: rgba(255,255,255,.2); transition: height .1s; }
.lk-seek:hover .lk-track, .lk-seek.lk-drag .lk-track { height: 5px; }
.lk-buf { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255,255,255,.4); }
.lk-fill { position: absolute; left: 0; top: 0; bottom: 0; background: ${RED}; }
.lk-knob { position: absolute; top: 50%; width: 13px; height: 13px; margin-left: -6.5px; border-radius: 50%; background: ${RED}; transform: translateY(-50%) scale(0); transition: transform .1s; }
.lk-seek:hover .lk-knob, .lk-seek.lk-drag .lk-knob { transform: translateY(-50%) scale(1); }
.lk-seek:hover, .lk-seek.lk-drag { align-items: flex-end; }

/* control row */
.lk-row { display: flex; align-items: center; height: 48px; }
.lk-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 48px; padding: 0; background: transparent; border: 0; color: #fff; cursor: pointer; opacity: .92; transition: opacity .1s; }
.lk-btn:hover { opacity: 1; }
.lk-btn[data-tip]:hover::after { content: attr(data-tip); position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%); white-space: nowrap; background: rgba(28,28,28,.92); color: #fff; font-size: 12.5px; font-weight: 500; padding: 6px 9px; border-radius: 4px; pointer-events: none; }
.lk-btn.lk-tip-l[data-tip]:hover::after { left: 0; transform: none; }
.lk-btn.lk-tip-r[data-tip]:hover::after { left: auto; right: 0; transform: none; }
.lk-gear svg { transition: transform .2s; }
.lk-gear.lk-on svg { transform: rotate(45deg); }

/* volume: icon + slider that slides out on hover */
.lk-vg { display: flex; align-items: center; }
.lk-vol { -webkit-appearance: none; appearance: none; width: 0; opacity: 0; height: 3px; margin: 0; padding: 0; border-radius: 2px; outline: none; cursor: pointer; background: linear-gradient(to right, #fff var(--v, 100%), rgba(255,255,255,.25) var(--v, 100%)); transition: width .2s ease, opacity .2s ease, margin .2s ease; }
.lk-vg:hover .lk-vol, .lk-vol:focus-visible, .lk-vol:active { width: 62px; opacity: 1; margin: 0 8px 0 0; }
.lk-vol::-webkit-slider-runnable-track { height: 3px; background: transparent; }
.lk-vol::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: -4.5px; border-radius: 50%; background: #fff; border: 0; }
.lk-vol::-moz-range-track { height: 3px; background: transparent; }
.lk-vol::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 0; }

.lk-time { font-size: 13px; font-variant-numeric: tabular-nums; margin-left: 4px; color: #ddd; white-space: nowrap; }
.lk-spacer { flex: 1; }

/* settings (speed) menu */
.lk-menu { position: absolute; right: 12px; bottom: 64px; min-width: 200px; max-height: 60vh; overflow: auto; padding: 6px 0; border-radius: 12px; background: rgba(28,28,28,.95); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 8px 30px rgba(0,0,0,.5); }
.lk-menu h4 { margin: 0; padding: 10px 16px 8px; font-size: 14px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,.12); }
.lk-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 16px 9px 12px; background: transparent; border: 0; color: #fff; font-size: 14px; text-align: left; cursor: pointer; }
.lk-item:hover { background: rgba(255,255,255,.1); }
.lk-item span.lk-ck { width: 20px; display: inline-flex; }

/* centre icon + spinner */
.lk-big { position: absolute; top: 50%; left: 50%; width: 72px; height: 72px; margin: -36px 0 0 -36px; border-radius: 50%; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; color: #fff; pointer-events: none; animation: lkpop .2s ease; }
.lk-spin { position: absolute; top: 50%; left: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; border: 4px solid rgba(255,255,255,.25); border-top-color: #fff; animation: lkspin .8s linear infinite; pointer-events: none; }
@keyframes lkspin { to { transform: rotate(360deg); } }
@keyframes lkpop { from { opacity: 0; transform: scale(.75); } to { opacity: 1; transform: scale(1); } }
@media (max-width: 560px) { .lk-vg:hover .lk-vol, .lk-vol { width: 0; opacity: 0; margin: 0; } .lk-btn { width: 40px; } }
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
  const menuOpen = useRef(false)

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
  const [menu, setMenu] = useState(false)    // speed menu
  const [rate, setRate] = useState(1)
  const [blocked, setBlocked] = useState(false) // browser refused autoplay-with-sound
  const [problem, setProblem] = useState('')

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { menuOpen.current = menu }, [menu])

  // browser Back button also counts as "going back" → home page shows the meme notice
  useEffect(() => {
    const flag = () => { try { sessionStorage.setItem(MEME_FLAG, '1') } catch (e) {} }
    window.addEventListener('popstate', flag)
    return () => window.removeEventListener('popstate', flag)
  }, [])

  const poke = useCallback(() => {
    setUi(true)
    clearTimeout(hideT.current)
    hideT.current = setTimeout(() => { if (v.current && !v.current.paused && !dragging.current && !menuOpen.current) setUi(false) }, 2800)
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
    if (menuOpen.current) { setMenu(false); return }
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
  const pickRate = (r) => { if (v.current) v.current.playbackRate = r; setRate(r); setMenu(false); poke() }
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

  // keyboard (same as YouTube): space/k play, ←/→ ±5s, j/l ±10s, ↑/↓ volume, m mute, f fullscreen
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && e.target.tagName === 'INPUT') return
      const el = v.current
      if (!el || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape' && menuOpen.current) { setMenu(false); return }
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
  const shownVol = muted ? 0 : vol
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
      {!playing && !wait && !blocked ? <div className="lk-big"><Play size={34} fill="#fff" style={{ marginLeft: 3 }} /></div> : null}

      <div className={'lk-ui lk-top' + (ui ? '' : ' lk-hide')}>
        <button className="lk-pill" onClick={goBack}><ArrowLeft size={18} /> Back to home</button>
      </div>

      <div className={'lk-ui lk-bottom' + (ui ? '' : ' lk-hide')} onClick={(e) => e.stopPropagation()}>
        {menu ? (
          <div className="lk-menu" role="menu">
            <h4>Playback speed</h4>
            {RATES.map((r) => (
              <button key={r} className="lk-item" role="menuitemradio" aria-checked={rate === r} onClick={() => pickRate(r)}>
                <span className="lk-ck">{rate === r ? <Check size={18} /> : null}</span>{r === 1 ? 'Normal' : r}
              </button>
            ))}
          </div>
        ) : null}

        <div ref={seek} className={'lk-seek' + (scrub !== null ? ' lk-drag' : '')}
          onPointerDown={seekDown} onPointerMove={seekMove} onPointerUp={seekUp} onPointerCancel={seekUp}>
          <div className="lk-track">
            <div className="lk-buf" style={{ width: (dur ? (buf / dur) * 100 : 0) + '%' }} />
            <div className="lk-fill" style={{ width: pct + '%' }} />
            <div className="lk-knob" style={{ left: pct + '%' }} />
          </div>
        </div>

        <div className="lk-row">
          <button className="lk-btn lk-tip-l" data-tip={playing ? 'Pause (k)' : 'Play (k)'} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={26} fill="currentColor" strokeWidth={0} /> : <Play size={26} fill="currentColor" strokeWidth={0} />}
          </button>
          <div className="lk-vg">
            <button className="lk-btn" data-tip={muted ? 'Unmute (m)' : 'Mute (m)'} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}><VolIcon size={24} strokeWidth={2} /></button>
            <input className="lk-vol" type="range" min="0" max="1" step="0.02" value={shownVol} aria-label="Volume"
              style={{ '--v': shownVol * 100 + '%' }}
              onChange={(e) => { const el = v.current; el.muted = false; el.volume = parseFloat(e.target.value) }} />
          </div>
          <span className="lk-time">{fmt(shownTime)} / {fmt(dur)}</span>
          <span className="lk-spacer" />
          <button className={'lk-btn lk-gear' + (menu ? ' lk-on' : '')} data-tip={menu ? '' : 'Settings'} aria-label="Playback speed" onClick={() => { setMenu((m) => !m); setUi(true) }}>
            <Settings size={23} strokeWidth={1.8} />
          </button>
          <button className="lk-btn lk-tip-r" data-tip={fs ? 'Exit full screen (f)' : 'Full screen (f)'} onClick={toggleFs} aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'}>
            {fs ? <Minimize size={24} strokeWidth={2} /> : <Maximize size={24} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {blocked ? (
        <button onClick={() => { const el = v.current; if (el) { el.muted = false; el.play().then(() => setBlocked(false)).catch(() => {}) } }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 22, fontWeight: 600, border: 0, cursor: 'pointer' }}>
          Tap to play ▶
        </button>
      ) : null}
      {problem ? (
        <p style={{ position: 'absolute', left: 0, right: 0, bottom: 100, textAlign: 'center', color: '#fca5a5', fontSize: 14, padding: '0 16px' }}>{problem}</p>
      ) : null}
    </div>,
    document.body
  )
}
