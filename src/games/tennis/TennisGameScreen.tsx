import { useEffect, useState, useSyncExternalStore } from 'react'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { TennisCanvas } from './TennisCanvas'
import { TennisResult } from './TennisResult'
import { TennisSession } from './TennisSession'
import { TennisTopbar } from './TennisTopbar'
import type { TennisHand } from './TennisCore'
import './TennisGameScreen.css'

export default function TennisGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new SportsMotionTestProvider())
  const [session] = useState(() => new TennisSession(provider))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void session.start()

    const trigger = (hand: TennisHand) => {
      provider.triggerSwing(hand, {
        timestampMs: session.getState().elapsedMs,
        vectorX: hand === 'LEFT' ? -0.82 : 0.82,
        vectorY: 0,
        intensity: 0.75,
      })
    }
    const handleKeyboard = (event: KeyboardEvent) => {
      const hand = event.code === 'KeyZ' || event.code === 'KeyQ'
        ? 'LEFT'
        : event.code === 'KeyC' || event.code === 'KeyE'
          ? 'RIGHT'
          : null
      if (!hand) return
      event.preventDefault()
      event.stopImmediatePropagation()
      trigger(hand)
    }
    window.addEventListener('keydown', handleKeyboard, true)

    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      const deltaMs = time - previousTime
      session.tick(deltaMs, { setupReady: true, hardFailure: false })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', handleKeyboard, true)
      void session.stop()
    }
  }, [provider, session])

  return (
    <main className="tennis-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <TennisTopbar state={state} onExit={onExit} developer />
      <section className="tennis-stage">
        <TennisCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <TennisResult state={state} onReplay={() => session.replay()} onExit={onExit} />
        ) : null}
      </section>
      <section className="tennis-test-controls" aria-label="網球測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>Z / Q：左手揮拍　C / E：右手揮拍</small>
        </div>
        <button type="button" onClick={() => provider.triggerSwing('LEFT', {
          timestampMs: session.getState().elapsedMs,
          vectorX: -0.82,
          vectorY: 0,
          intensity: 0.75,
        })}>左手揮拍</button>
        <button type="button" onClick={() => provider.triggerSwing('RIGHT', {
          timestampMs: session.getState().elapsedMs,
          vectorX: 0.82,
          vectorY: 0,
          intensity: 0.75,
        })}>右手揮拍</button>
      </section>
    </main>
  )
}
