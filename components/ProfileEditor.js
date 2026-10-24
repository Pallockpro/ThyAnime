'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Link2, Trash2, Unlink, X } from 'lucide-react'
import { useAuth } from './AuthProvider'
import Avatar from './Avatar'
import { AVATARS, NAME_MAX } from '../lib/profiles'

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 7.2-9.6 7.2-16.9z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

/**
 * Modal for a profile.
 *   mode "create"           → family owner adds a profile
 *   mode "edit"             → family owner edits any profile (rename, avatar, link Google, delete)
 *   mode "edit" + self      → you edit yourself (family profile in use / linked Gmail / plain Google account)
 */
export default function ProfileEditor({ mode = 'edit', profile, self = false, onClose }) {
  const { profiles, me, addProfile, saveProfile, saveMyProfile, deleteProfile, linkGoogle, unlinkGoogle } = useAuth()
  const live = (profile && profiles && profiles.find((p) => p.id === profile.id)) || profile || null
  const isPrimary = !!(live && (live.primary || (profiles && profiles[0] && profiles[0].id === live.id)))
  const showAvatars = !self || (me && me.kind !== 'google')

  const [name, setName] = useState(live ? live.name || '' : (self && me ? me.name : ''))
  const [avatar, setAvatar] = useState(live && live.avatar != null ? String(live.avatar) : self && me && me.avatar != null ? String(me.avatar) : String(Math.floor(Math.random() * AVATARS.length)))
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])

  const run = async (label, fn, closeOnOk) => {
    setBusy(label); setErr('')
    const r = await fn()
    setBusy('')
    if (!r || !r.ok) { if (r && r.error) setErr(r.error); return }
    if (closeOnOk) onClose()
  }

  const submit = (e) => {
    e.preventDefault()
    if (busy) return
    if (mode === 'create') run('save', () => addProfile({ name, avatar }), true)
    else if (self) run('save', () => saveMyProfile({ name, avatar }), true)
    else run('save', () => saveProfile(live.id, { name, avatar }), true)
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }}
        className="menu-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{mode === 'create' ? 'Add profile' : self && me && me.kind === 'google' ? 'Edit name' : 'Edit profile'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-4">
          <Avatar avatar={showAvatars ? avatar : null} photo={!showAvatars && me ? me.photo : ''} name={name} size={72} rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <label htmlFor="pe-name" className="mb-1 block text-xs font-medium text-zinc-400">Profile name</label>
            <input id="pe-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoFocus autoComplete="off"
              placeholder="Your name"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition focus:ring-1 focus:ring-blossom-500" />
          </div>
        </div>

        {showAvatars ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-zinc-400">Avatar</p>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((_, i) => {
                const on = String(i) === avatar
                return (
                  <button key={i} type="button" onClick={() => setAvatar(String(i))} aria-label={'Avatar ' + (i + 1)} aria-pressed={on}
                    className={'flex justify-center rounded-xl p-0.5 transition ' + (on ? 'ring-2 ring-blossom-400' : 'opacity-70 hover:opacity-100')}>
                    <Avatar avatar={String(i)} size={36} rounded="rounded-lg" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {mode === 'edit' && !self && live ? (
          <div className="mt-6 rounded-2xl bg-white/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><GoogleG /> Google account</p>
            {live.google ? (
              <>
                <p className="mt-2 break-all text-sm text-zinc-300">Linked: <span className="font-medium text-white">{live.google.email}</span></p>
                <p className="mt-1 text-xs text-zinc-500">That Google account signs in on the Sign in page and goes straight to this profile.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={!!busy} onClick={() => run('link', () => linkGoogle(live.id, profiles))} className="glass flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition hover:bg-white/15 disabled:opacity-60"><Link2 size={14} /> {busy === 'link' ? 'Waiting…' : 'Change Gmail'}</button>
                  <button type="button" disabled={!!busy} onClick={() => run('unlink', () => unlinkGoogle(live.id, live.google.uid))} className="glass flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/15 disabled:opacity-60"><Unlink size={14} /> {busy === 'unlink' ? 'Removing…' : 'Unlink'}</button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-zinc-500">Optional. Link this person’s Gmail so they can use “Continue with Google” and land right in their own profile.</p>
                <button type="button" disabled={!!busy} onClick={() => run('link', () => linkGoogle(live.id, profiles))} className="mt-3 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:scale-[1.03] disabled:opacity-60">
                  <GoogleG /> {busy === 'link' ? 'Waiting for Google…' : 'Link a Google account'}
                </button>
              </>
            )}
          </div>
        ) : null}

        {err ? <p className="mt-4 text-sm text-amber-300/90">{err}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!!busy || !name.trim()} className="rounded-full bg-blossom-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blossom-400 disabled:opacity-50">
            {busy === 'save' ? 'Saving…' : mode === 'create' ? 'Create profile' : 'Save'}
          </button>
          <button type="button" onClick={onClose} className="glass rounded-full px-5 py-2.5 text-sm transition hover:bg-white/15">Cancel</button>
          {mode === 'edit' && !self && live && !isPrimary ? (
            <span className="ml-auto">
              {confirmDel ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-300">Delete its history too?</span>
                  <button type="button" disabled={!!busy} onClick={() => run('del', () => deleteProfile(live.id, live.google && live.google.uid), true)} className="rounded-full bg-red-500/90 px-3 py-1.5 font-semibold text-white">Delete</button>
                  <button type="button" onClick={() => setConfirmDel(false)} className="text-zinc-400 hover:text-white">No</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-red-300/90 transition hover:bg-red-500/10"><Trash2 size={14} /> Delete</button>
              )}
            </span>
          ) : null}
        </div>
        {mode === 'edit' && !self && isPrimary ? <p className="mt-3 text-xs text-zinc-500">The main profile can’t be deleted.</p> : null}
      </motion.form>
    </div>,
    document.body,
  )
}
