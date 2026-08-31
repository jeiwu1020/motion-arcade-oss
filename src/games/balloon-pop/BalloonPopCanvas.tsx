import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { BalloonPopScenePresentation } from './BalloonPopScene'
import type { BalloonPopSession } from './BalloonPopSession'

interface BalloonPopCanvasProps {
  readonly session: BalloonPopSession
  readonly presentation?: BalloonPopScenePresentation
}

export function BalloonPopCanvas({
  session,
  presentation = 'STANDARD',
}: BalloonPopCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    const factoryPromise = import('./createBalloonPopPhaserGame').then(
      ({ createBalloonPopPhaserGame }) =>
        (parent: HTMLElement) =>
          createBalloonPopPhaserGame(parent, session, presentation),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : '無法載入遊戲畫面')
      }
    })

    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [presentation, session])

  return (
    <div
      ref={hostRef}
      className="balloon-pop-canvas"
      aria-label="氣球拍拍樂遊戲區"
    >
      {loadError ? <p className="balloon-pop-load-error">{loadError}</p> : null}
    </div>
  )
}
