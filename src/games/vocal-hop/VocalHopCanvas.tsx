import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { VocalHopSession } from './VocalHopSession'

export function VocalHopCanvas({ session }: { readonly session: VocalHopSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createVocalHopPhaserGame').then(
      ({ createVocalHopPhaserGame }) => (parent: HTMLElement) => createVocalHopPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入聲控跳跳樂畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return <div ref={hostRef} className="vocal-hop-canvas" aria-label="聲控跳跳樂遊戲區">{error ? <p>{error}</p> : null}</div>
}
