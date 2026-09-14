import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { BadmintonSession } from './BadmintonSession'

export function BadmintonCanvas({ session }: { readonly session: BadmintonSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createBadmintonPhaserGame').then(
      ({ createBadmintonPhaserGame }) =>
        (parent: HTMLElement) => createBadmintonPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入羽球畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="badminton-canvas" aria-label="羽球快打遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
