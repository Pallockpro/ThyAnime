'use client'
import { useEffect, useState } from 'react'

export default function Petals() {
  const [petals, setPetals] = useState([])
  useEffect(() => {
    setPetals(Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 8 + Math.random() * 10,
      dur: 12 + Math.random() * 14,
      delay: -Math.random() * 20,
      drift: (Math.random() - 0.3) * 160,
    })))
  }, [])
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {petals.map((p) => (
        <span key={p.id} className="petal"
          style={{ left: p.left + '%', width: p.size, height: p.size, animationDuration: p.dur + 's', animationDelay: p.delay + 's', '--drift': p.drift + 'px' }} />
      ))}
    </div>
  )
}
