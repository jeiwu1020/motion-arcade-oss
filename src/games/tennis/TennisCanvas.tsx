import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { TennisSession } from './TennisSession'

export function TennisCanvas({ session }: { readonly session: TennisSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createTennisPhaserGame').then(
      ({ createTennisPhaserGame }) =>
        (parent: HTMLElement) => createTennisPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : '無法載入網球畫面')
      }
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="tennis-canvas" aria-label="網球對決遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
