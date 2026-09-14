import { useEffect, useState, useSyncExternalStore } from 'react'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { BowlingCanvas } from './BowlingCanvas'
import { BowlingResult } from './BowlingResult'
import { BowlingSession } from './BowlingSession'
import type { BowlingHand } from './BowlingCore'
import { BowlingTopbar } from './BowlingTopbar'
import './BowlingGameScreen.css'

export function BowlingGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new SportsMotionTestProvider())
  const [session] = useState(() => new BowlingSession(provider))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void session.start()
    const trigger = (hand: BowlingHand, strong = false) => {
      provider.triggerSwing(hand, {
        timestampMs: session.getState().elapsedMs,
        vectorX: hand === 'LEFT' ? -0.5 : 0.5,
        vectorY: 0,
        intensity: strong ? 1 : 0.75,
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
      trigger(hand, event.shiftKey)
    }
    window.addEventListener('keydown', handleKeyboard, true)
    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      session.tick(time - previousTime, { setupReady: true, hardFailure: false })
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

  const triggerButton = (hand: BowlingHand) => {
    provider.triggerSwing(hand, {
      timestampMs: session.getState().elapsedMs,
      vectorX: hand === 'LEFT' ? -0.5 : 0.5,
      vectorY: 0,
      intensity: 0.75,
    })
  }

  return (
    <main className="bowling-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <BowlingTopbar state={state} onExit={onExit} developer />
      <section className="bowling-stage">
        <BowlingCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <BowlingResult state={state} onReplay={() => session.replay()} onExit={onExit} />
        ) : null}
      </section>
      <section className="bowling-test-controls" aria-label="保齡球測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>自動瞄準標記會左右掃描</small>
          <small>Z / Q：左手投球　C / E：右手投球</small>
          <small>Shift + Z / C：強力投球測試</small>
        </div>
        <button type="button" onClick={() => triggerButton('LEFT')}>左手投球</button>
        <button type="button" onClick={() => triggerButton('RIGHT')}>右手投球</button>
      </section>
    </main>
  )
}
