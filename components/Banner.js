'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { BANNER_ROTATE_MS } from '../lib/config'

const DISMISS_KEY = 'thy_banner_dismissed'
const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Announcement bar controlled from Firebase: config/banner → Text, Text2 … + Visible + rotations.
//   rotations false → shows Text only.
//   rotations true  → cycles Text, Text2, Text3 … every 10 s, skipping blank ones, and loops.
// Fixed to the top; it publishes its height as --banner-h so the navbar and page content sit right below it.
export default function Banner() {
  const { banner } = useAuth()
  const [dismissed, setDismissed] = useState('')
  const [idx, setIdx] = useState(0)
  const box = useRef(null)

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) || '') } catch (e) {}
  }, [])

  const items = banner.items || []
  // One signature for the whole set of messages: closing the banner closes it for the session,
  // but changing any message (or adding / removing one) makes it show again.
  const sig = items.join('\n')
  const show = banner.visible && items.length > 0 && dismissed !== sig
  const rotating = banner.rotations && items.length > 1

  // start from the first message again whenever the messages change
  useEffect(() => { setIdx(0) }, [sig, banner.rotations])

  // the 10 s rotation (blank messages were already dropped by normalizeBanner, so nothing empty is ever shown)
  useEffect(() => {
    if (!show || !rotating) return
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), BANNER_ROTATE_MS)
    return () => clearInterval(t)
  }, [show, rotating, items.length, sig])

  const current = items.length ? items[(rotating ? idx : 0) % items.length] : ''

  useIso(() => {
    const root = document.documentElement
    if (!show || !box.current) { root.style.setProperty('--banner-h', '0px'); return }
    const el = box.current
    const set = () => root.style.setProperty('--banner-h', el.offsetHeight + 'px')
    set()
    let ro
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(set); ro.observe(el) }
    window.addEventListener('resize', set)
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', set); root.style.setProperty('--banner-h', '0px') }
  }, [show, current])

  if (!show) return null

  const close = () => {
    setDismissed(sig)
    try { sessionStorage.setItem(DISMISS_KEY, sig) } catch (e) {}
  }

  return (
    <div ref={box} role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-gradient-to-r from-blossom-600/90 via-blossom-500/90 to-fuchsia-500/90 shadow-lg shadow-black/30 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm font-medium text-white">
        <Megaphone size={16} className="shrink-0" aria-hidden />
        <p key={rotating ? idx : 'static'} className={'min-w-0 flex-1 whitespace-pre-line break-words text-center leading-snug' + (rotating ? ' animate-bannerin' : '')}>{current}</p>
        <button onClick={close} aria-label="Dismiss banner" className="shrink-0 rounded-full p-1 transition hover:bg-white/20"><X size={16} /></button>
      </div>
    </div>
  )
}
