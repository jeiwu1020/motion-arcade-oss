import { useEffect, useRef, useState } from 'react'
import { mountPhaserGame } from '../../game/phaser/mountPhaserGame'
import type { SoundCannonSession } from './SoundCannonSession'

export function SoundCannonCanvas({ session }: { readonly session: SoundCannonSession }) {
  const hostRef = useRef<HTMLDivElement>(null); const [error, setError] = useState<string>()
  useEffect(() => { const host = hostRef.current; if (!host) return undefined; let cancelled = false; const promise = import('./createSoundCannonPhaserGame').then(({ createSoundCannonPhaserGame }) => (parent: HTMLElement) => createSoundCannonPhaserGame(parent, session)); const mount = mountPhaserGame.lazy(host, promise); void mount.ready.catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '無法載入音波砲場景') }); return () => { cancelled = true; mount.unmount() } }, [session])
  return <div ref={hostRef} className="sound-cannon-canvas" aria-label="音波砲遊戲區">{error ? <p>{error}</p> : null}</div>
}
