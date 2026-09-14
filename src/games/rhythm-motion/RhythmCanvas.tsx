import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { RhythmSession } from './RhythmSession'

export function RhythmCanvas({ session }: { readonly session: RhythmSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createRhythmPhaserGame').then(
      ({ createRhythmPhaserGame }) =>
        (parent: HTMLElement) => createRhythmPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : '無法載入節奏畫面')
      }
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="rhythm-canvas" aria-label="節奏動一動遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
