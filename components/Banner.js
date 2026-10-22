'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { useAuth } from './AuthProvider'

const DISMISS_KEY = 'thy_banner_dismissed'
const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Announcement bar controlled from Firebase: config/banner → Text + Visible.
// Fixed to the top; it publishes its height as --banner-h so the navbar and page content sit right below it.
export default function Banner() {
  const { banner } = useAuth()
  const [dismissed, setDismissed] = useState('')
  const box = useRef(null)

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) || '') } catch (e) {}
  }, [])

  // A closed banner stays closed for the session — but a new message (different Text) shows again.
  const show = banner.visible && banner.text && dismissed !== banner.text

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
  }, [show, banner.text])

  if (!show) return null

  const close = () => {
    setDismissed(banner.text)
    try { sessionStorage.setItem(DISMISS_KEY, banner.text) } catch (e) {}
  }

  return (
    <div ref={box} role="status" className="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-gradient-to-r from-blossom-600/90 via-blossom-500/90 to-fuchsia-500/90 shadow-lg shadow-black/30 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm font-medium text-white">
        <Megaphone size={16} className="shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 whitespace-pre-line break-words text-center leading-snug">{banner.text}</p>
        <button onClick={close} aria-label="Dismiss banner" className="shrink-0 rounded-full p-1 transition hover:bg-white/20"><X size={16} /></button>
      </div>
    </div>
  )
}
