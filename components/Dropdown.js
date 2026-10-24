'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Custom dropdown (replaces the native <select>, whose option list is drawn by the OS and ignores our theme).
 * options: [[value, label], ...]   Keyboard: ↑ ↓ Home End Enter Space Esc Tab, plus type-to-jump.
 */
export default function Dropdown({ value, onChange, options, label, className = '' }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef(null)
  const list = useRef(null)
  const typed = useRef({ s: '', t: 0 })
  const uid = useId()

  const selIdx = Math.max(0, options.findIndex(([v]) => v === value))
  const current = options[selIdx] || options[0]

  const openMenu = useCallback(() => { setActive(selIdx); setOpen(true) }, [selIdx])
  const pick = useCallback((i) => { setOpen(false); if (options[i] && options[i][0] !== value) onChange(options[i][0]) }, [options, value, onChange])

  // close on outside click / touch
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('touchstart', away, { passive: true })
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away) }
  }, [open])

  // keep the highlighted option in view
  useEffect(() => {
    if (!open || !list.current) return
    const el = list.current.children[active]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKey = (e) => {
    const n = options.length
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % n) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + n) % n) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now()
      typed.current.s = (now - typed.current.t > 700 ? '' : typed.current.s) + e.key.toLowerCase()
      typed.current.t = now
      const hit = options.findIndex(([, l]) => l.toLowerCase().startsWith(typed.current.s))
      if (hit >= 0) setActive(hit)
    }
  }

  return (
    <div ref={wrap} className={'relative ' + className}>
      <button
        type="button" onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKey}
        aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        aria-controls={uid + '-list'} aria-activedescendant={open ? uid + '-o' + active : undefined}
        className={'glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white outline-none transition hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-blossom-500 ' + (open ? 'ring-1 ring-blossom-500' : '')}
      >
        <span className="whitespace-nowrap">{current ? current[1] : ''}</span>
        <ChevronDown size={16} className={'text-zinc-400 transition-transform duration-200 ' + (open ? 'rotate-180' : '')} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={list} id={uid + '-list'} role="listbox" aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }} style={{ transformOrigin: 'top left' }}
            className="menu-panel dd-scroll absolute left-0 top-full z-40 mt-2 max-h-72 w-max min-w-full overflow-y-auto rounded-2xl p-1.5 shadow-2xl shadow-black/60"
          >
            {options.map(([v, l], i) => {
              const on = v === value
              return (
                <li
                  key={v || '_all'} id={uid + '-o' + i} role="option" aria-selected={on}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}
                  className={'flex cursor-pointer items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors ' +
                    (i === active ? 'bg-white/10 ' : '') + (on ? 'font-semibold text-blossom-300' : 'text-zinc-200')}
                >
                  <span>{l}</span>
                  {on ? <Check size={15} className="shrink-0" /> : null}
                </li>
              )
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
