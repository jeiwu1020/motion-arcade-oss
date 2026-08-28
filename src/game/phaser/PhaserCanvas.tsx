import { useEffect, useRef } from 'react'

import { createPhaserGame } from './createPhaserGame'
import { mountPhaserGame } from './mountPhaserGame'

export function PhaserCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    return mountPhaserGame(host, createPhaserGame)
  }, [])

  return (
    <div
      ref={hostRef}
      className="phaser-canvas-host"
      aria-label="Phaser Phase 0 proof canvas"
    />
  )
}
