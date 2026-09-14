import { useEffect, useState, useSyncExternalStore } from 'react'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { HighJumpCanvas } from './HighJumpCanvas'
import { HighJumpResult } from './HighJumpResult'
import { HighJumpSession } from './HighJumpSession'
import { HighJumpTopbar } from './HighJumpTopbar'
import './HighJumpGameScreen.css'

const HIGH_JUMP_ACTIONS = ['JUMP'] as const

export default function HighJumpGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new KeyboardMouseTestInputProvider({
    keyboardTarget: typeof window === 'undefined' ? new EventTarget() : window,
  }))
  const [session] = useState(() => new HighJumpSession(provider))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void provider.start({
      players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }],
      actions: HIGH_JUMP_ACTIONS,
      sensors: { pose: false, hands: false, audio: false },
    }).then(() => session.start())

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'KeyW' && event.code !== 'ArrowUp') return
      event.preventDefault()
      event.stopImmediatePropagation()
      provider.triggerAction('player-1', 'JUMP')
    }
    window.addEventListener('keydown', handleKeyboard, true)

    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      const deltaMs = Math.max(0, time - previousTime)
      provider.update(deltaMs)
      session.tick(deltaMs, { setupReady: true, hardFailure: false })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', handleKeyboard, true)
      void session.stop()
      void provider.stop()
    }
  }, [provider, session])

  const triggerJump = () => provider.triggerAction('player-1', 'JUMP')

  return (
    <main className="high-jump-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <HighJumpTopbar state={state} onExit={onExit} developer />
      <section className="high-jump-stage">
        <HighJumpCanvas session={session} />
        {state.phase === 'FINISHED' ? <HighJumpResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}
      </section>
      <section className="high-jump-test-controls" aria-label="跳高挑戰測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>Space / W / ↑：跳躍</small>
          <small>輕輕跳即可，時機決定 CLEAR 與分數</small>
        </div>
        <button type="button" onClick={triggerJump}>跳躍</button>
      </section>
    </main>
  )
}
