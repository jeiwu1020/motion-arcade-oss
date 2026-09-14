import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { SwimmingSession } from './SwimmingSession'

export function SwimmingCanvas({ session }: { readonly session: SwimmingSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createSwimmingPhaserGame').then(
      ({ createSwimmingPhaserGame }) => (parent: HTMLElement) => createSwimmingPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入泳池畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return <div ref={hostRef} className="swimming-canvas" aria-label="泳池衝刺遊戲區">{error ? <p>{error}</p> : null}</div>
}
