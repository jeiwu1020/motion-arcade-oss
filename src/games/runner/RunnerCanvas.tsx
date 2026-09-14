import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { RunnerSession } from './RunnerSession'

export function RunnerCanvas({ session }: { readonly session: RunnerSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createRunnerPhaserGame').then(
      ({ createRunnerPhaserGame }) =>
        (parent: HTMLElement) => createRunnerPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : '無法載入跑酷畫面')
      }
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="runner-canvas" aria-label="跑酷衝刺遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
