import { useEffect, useState } from 'react'
import { SERVERS, probe } from './servers'

/**
 * Live up/down map for servers that have a `probe` URL (your own ThyAnime server).
 * { thy: true } = up · { thy: false } = down · key missing = still checking.
 * Re-checks every `every` ms and when the tab becomes visible again, so a server that
 * dies (or comes back) while someone is on the page is picked up automatically.
 */
export function useServerStatus(every = 30000) {
  const [up, setUp] = useState({})
  useEffect(() => {
    let dead = false
    const run = () => SERVERS.filter((s) => s.probe).forEach((s) => probe(s.probe).then((ok) => { if (!dead) setUp((u) => (u[s.key] === ok ? u : { ...u, [s.key]: ok })) }))
    run()
    const iv = setInterval(run, every)
    const vis = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', vis)
    return () => { dead = true; clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [every])
  return up
}
