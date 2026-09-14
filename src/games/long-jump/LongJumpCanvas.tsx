import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { LongJumpSession } from './LongJumpSession'

export function LongJumpCanvas({ session }: { readonly session: LongJumpSession }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createLongJumpPhaserGame').then(
      ({ createLongJumpPhaserGame }) => (parent: HTMLElement) => createLongJumpPhaserGame(parent, session),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入飛躍挑戰畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [session])

  return (
    <div ref={hostRef} className="long-jump-canvas" aria-label="飛躍挑戰遊戲區">
      {error ? <p>{error}</p> : null}
    </div>
  )
}
