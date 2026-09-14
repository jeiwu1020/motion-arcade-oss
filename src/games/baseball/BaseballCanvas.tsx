import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { BaseballSession } from './BaseballSession'

export function BaseballCanvas({ session }: { readonly session: BaseballSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createBaseballPhaserGame').then(
      ({ createBaseballPhaserGame }) =>
        (parent: HTMLElement) => createBaseballPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : '無法載入棒球場')
      }
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="baseball-canvas" aria-label="全壘打王遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
