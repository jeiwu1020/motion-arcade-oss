import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { HighJumpSession } from './HighJumpSession'

export function HighJumpCanvas({ session }: { readonly session: HighJumpSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createHighJumpPhaserGame').then(
      ({ createHighJumpPhaserGame }) => (parent: HTMLElement) => createHighJumpPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入跳高畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="high-jump-canvas" aria-label="跳高挑戰遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
