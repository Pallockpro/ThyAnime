'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Compass, Copy, ExternalLink, Film, Home, Link2, Newspaper, RotateCw, Search, Settings, TrendingUp } from 'lucide-react'

// Custom right-click menu.
//  • Normal right-click on the page      → navigation + page actions
//  • Right-click on a link / anime card  → open / open in new tab / copy link
//  • Right-click on selected text        → copy / search on ThyAnime
//  • Inputs & text boxes keep the browser's own menu (so paste, spellcheck, etc. still work)
//  • Hold SHIFT while right-clicking to get the browser's normal menu (inspect element, etc.)
//  • Skipped on touch screens (long-press keeps working normally)
//  • Right-clicking inside a video player iframe can't be intercepted — that is the player's own page.

function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text)
  } catch (e) {}
  return new Promise((resolve) => {
    const t = document.createElement('textarea')
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select()
    try { document.execCommand('copy') } catch (e) {}
    document.body.removeChild(t); resolve()
  })
}

export default function ContextMenu() {
  const router = useRouter()
  const [menu, setMenu] = useState(null)   // { x, y, link, sel }
  const [adj, setAdj] = useState(null)     // position after clamping to the viewport
  const [toast, setToast] = useState('')
  const ref = useRef(null)

  const close = useCallback(() => setMenu(null), [])
  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 1600) }, [])

  useEffect(() => {
    const onCtx = (e) => {
      if (e.shiftKey) return                                              // Shift = native menu
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
      e.preventDefault()
      const a = t.closest('a[href]')
      const sel = (window.getSelection() && window.getSelection().toString().trim()) || ''
      setMenu({ x: e.clientX, y: e.clientY, link: a ? a.href : '', sel: sel.slice(0, 200) })
    }
    document.addEventListener('contextmenu', onCtx)
    return () => document.removeEventListener('contextmenu', onCtx)
  }, [])

  // close on anything that would make the menu stale
  useEffect(() => {
    if (!menu) return
    const onKey = (e) => {
      if (e.key === 'Escape') return close()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = ref.current ? Array.from(ref.current.querySelectorAll('button')) : []
        if (!items.length) return
        const i = items.indexOf(document.activeElement)
        const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1)
        items[n].focus()
      }
    }
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [menu, close])

  // keep the menu fully on screen
  useLayoutEffect(() => {
    if (!menu || !ref.current) { setAdj(null); return }
    const r = ref.current.getBoundingClientRect()
    setAdj({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)),
    })
  }, [menu])

  const go = (href) => () => { close(); router.push(href) }
  const act = (fn) => () => { close(); fn() }

  const groups = []
  if (menu) {
    if (menu.sel) {
      groups.push([
        { icon: Copy, label: 'Copy', run: act(() => copyText(menu.sel).then(() => say('Copied'))) },
        { icon: Search, label: 'Search “' + (menu.sel.length > 22 ? menu.sel.slice(0, 22) + '…' : menu.sel) + '”', run: go('/search/?q=' + encodeURIComponent(menu.sel)) },
      ])
    }
    if (menu.link) {
      groups.push([
        { icon: ExternalLink, label: 'Open link in new tab', run: act(() => window.open(menu.link, '_blank', 'noopener')) },
        { icon: Link2, label: 'Copy link address', run: act(() => copyText(menu.link).then(() => say('Link copied'))) },
      ])
    }
    groups.push([
      { icon: ArrowLeft, label: 'Back', run: act(() => window.history.back()) },
      { icon: ArrowRight, label: 'Forward', run: act(() => window.history.forward()) },
      { icon: RotateCw, label: 'Reload', run: act(() => window.location.reload()) },
    ])
    groups.push([
      { icon: Home, label: 'Home', run: go('/') },
      { icon: Compass, label: 'Browse', run: go('/search/') },
      { icon: TrendingUp, label: 'Trending', run: go('/search/?sort=TRENDING_DESC') },
      { icon: Film, label: 'Movies', run: go('/search/?format=MOVIE') },
      { icon: Newspaper, label: 'News', run: go('/news/') },
      { icon: Settings, label: 'Settings', run: go('/settings/') },
    ])
    if (!menu.link) {
      groups.push([{ icon: Link2, label: 'Copy page link', run: act(() => copyText(window.location.href).then(() => say('Link copied'))) }])
    }
  }

  const pos = adj || (menu ? { x: menu.x, y: menu.y } : { x: 0, y: 0 })
  return (
    <>
      <AnimatePresence>
        {menu ? (
          <motion.div
            key="ctx" ref={ref} role="menu"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ left: pos.x, top: pos.y, transformOrigin: 'top left', visibility: adj ? 'visible' : 'hidden' }}
            className="menu-panel fixed z-[200] w-60 overflow-hidden rounded-2xl p-1.5 shadow-2xl shadow-black/60 ring-1 ring-white/10"
          >
            {groups.map((g, gi) => (
              <div key={gi} className={gi > 0 ? 'mt-1 border-t border-white/10 pt-1' : ''}>
                {g.map((it) => (
                  <button key={it.label} role="menuitem" onClick={it.run}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 outline-none transition-colors hover:bg-blossom-500/25 hover:text-white focus-visible:bg-blossom-500/25 focus-visible:text-white">
                    <it.icon size={16} className="shrink-0 text-blossom-400" />
                    <span className="truncate">{it.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {toast ? (
          <motion.div key="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="menu-panel fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm shadow-xl ring-1 ring-white/10">
            <Check size={14} className="text-emerald-400" /> {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
