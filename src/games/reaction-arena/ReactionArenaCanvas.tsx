import { useEffect, useRef, useState } from 'react'

import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { ReactionArenaAudio } from './ReactionArenaAudio'
import type { ReactionArenaSession } from './ReactionArenaSession'

export function ReactionArenaCanvas({ session, audio }: { readonly session: ReactionArenaSession; readonly audio?: ReactionArenaAudio }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    const factoryPromise = import('./createReactionArenaPhaserGame').then(({ createReactionArenaPhaserGame }) =>
      (parent: HTMLElement) => createReactionArenaPhaserGame(parent, session, audio))
    const mount = mountPhaserGame.lazy(host, factoryPromise)
    void mount.ready.catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入反應遊戲畫面')
    })
    return () => {
      cancelled = true
      mount.unmount()
    }
  }, [audio, session])

  return <div ref={hostRef} className="reaction-arena-canvas" aria-label="光速反應王遊戲區">
    {error ? <p>{error}</p> : null}
  </div>
}
