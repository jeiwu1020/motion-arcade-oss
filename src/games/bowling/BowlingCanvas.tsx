import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { BowlingSession } from './BowlingSession'

export function BowlingCanvas({ session }: { readonly session: BowlingSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createBowlingPhaserGame').then(
      ({ createBowlingPhaserGame }) =>
        (parent: HTMLElement) => createBowlingPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入保齡球畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="bowling-canvas" aria-label="保齡球大賽遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
