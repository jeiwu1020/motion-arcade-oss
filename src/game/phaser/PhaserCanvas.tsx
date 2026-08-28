import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from './mountPhaserGame'
import type { TestLabMotionBridge } from './TestLabMotionBridge'
import type { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'

interface PhaserCanvasProps {
  readonly bridge: TestLabMotionBridge
  readonly provider: KeyboardMouseTestInputProvider
}

export function PhaserCanvas({ bridge, provider }: PhaserCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    provider.attachPointerSurface(host)
    let cancelled = false
    const factoryPromise = import('./createPhaserGame').then(
      ({ createPhaserGame }) =>
        (parent: HTMLElement) => createPhaserGame(parent, bridge),
    )
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load Phaser')
      }
    })

    return () => {
      cancelled = true
      provider.attachPointerSurface(undefined)
      mount.unmount()
    }
  }, [bridge, provider])

  return (
    <div
      ref={hostRef}
      className="phaser-canvas-host"
      aria-label="Normalized input Phaser test field"
    >
      {loadError ? <p className="phaser-load-error">{loadError}</p> : null}
    </div>
  )
}
