import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { RunningRaceSession } from './RunningRaceSession'

export function RunningRaceCanvas({ session }: { readonly session: RunningRaceSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createRunningRacePhaserGame').then(
      ({ createRunningRacePhaserGame }) =>
        (parent: HTMLElement) => createRunningRacePhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入衝刺畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="running-race-canvas" aria-label="原地衝刺王遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
