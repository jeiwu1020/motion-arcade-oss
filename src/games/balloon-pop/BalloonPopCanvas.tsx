import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { SpatialCollisionInputAdapter } from '../../spatial/SpatialCollisionInputAdapter'
import type { BalloonPopScenePresentation } from './BalloonPopScene'
import type { BalloonPopSession } from './BalloonPopSession'

interface BalloonPopCanvasProps {
  readonly session: BalloonPopSession
  readonly presentation?: BalloonPopScenePresentation
  readonly spatialCollisionInput?: SpatialCollisionInputAdapter
}

export function BalloonPopCanvas({
  session,
  presentation = 'STANDARD',
  spatialCollisionInput,
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
          createBalloonPopPhaserGame(
            parent,
            session,
            presentation,
            spatialCollisionInput,
          ),
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
  }, [presentation, session, spatialCollisionInput])

  return (
    <div
      ref={hostRef}
      className="balloon-pop-canvas"
      aria-label="氣球拍拍樂遊戲區"
      data-spatial-collision-probe={spatialCollisionInput ? 'enabled' : undefined}
    >
      {loadError ? <p className="balloon-pop-load-error">{loadError}</p> : null}
    </div>
  )
}
