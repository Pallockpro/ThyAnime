// Live "people on the site right now" counter, built on Firebase Realtime Database presence.
//
// Every open tab writes  presence/<visitorId>/<tabId> = true  and registers an onDisconnect() remove on the
// server, so the entry disappears the moment the tab closes / the connection drops (no timers, no guessing).
// <visitorId> is a random id kept in this browser, so several tabs from the same browser count as ONE person.
// The count = number of distinct visitor ids under presence/.
import { onDisconnect, onValue, ref, remove, set } from 'firebase/database'

const rand = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)

export function getVisitorId() {
  try {
    let v = localStorage.getItem('thy_vid')
    if (!v) { v = rand(); localStorage.setItem('thy_vid', v) }
    return v
  } catch (e) {
    if (!getVisitorId.fallback) getVisitorId.fallback = rand()
    return getVisitorId.fallback
  }
}

/** Mark this tab as online. Returns a function that marks it offline again. */
export function startPresence(db) {
  const me = ref(db, 'presence/' + getVisitorId() + '/' + rand())
  const off = onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() !== true) return
    // (re)register on every (re)connect: server removes the entry if we vanish, then we mark ourselves online
    onDisconnect(me).remove().then(() => set(me, true)).catch(() => {})
  })
  return () => { off(); remove(me).catch(() => {}) }
}

/** Live number of distinct visitors online. cb(count) / onError(). Always includes the current visitor. */
export function watchOnlineCount(db, cb, onError) {
  const vid = getVisitorId()
  return onValue(
    ref(db, 'presence'),
    (snap) => cb(snap.size + (snap.hasChild(vid) ? 0 : 1)), // modular SDK: size = number of children. You are here, so you count even before your own entry lands
    () => onError && onError(),
  )
}
