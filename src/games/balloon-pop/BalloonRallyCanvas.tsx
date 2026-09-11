import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { BalloonRallySession } from './BalloonRallySession'
import type { BalloonRallyAudio } from './BalloonRallyAudio'

interface BalloonRallyCanvasProps {
  readonly session: BalloonRallySession
  readonly audio?: BalloonRallyAudio
}

/** Lazy production Camera AR playfield; no DOM diagnostic or sensor ownership. */
export function BalloonRallyCanvas({
  session,
  audio,
}: BalloonRallyCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let cancelled = false
    const factoryPromise = import('./createBalloonRallyPhaserGame').then(
      ({ createBalloonRallyPhaserGame }) =>
        (parent: HTMLElement) =>
          createBalloonRallyPhaserGame(parent, session, audio),
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
  }, [audio, session])

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
