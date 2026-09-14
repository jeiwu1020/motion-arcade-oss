import { useEffect, useState, useSyncExternalStore } from 'react'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { BadmintonCanvas } from './BadmintonCanvas'
import { BadmintonResult } from './BadmintonResult'
import { BadmintonSession } from './BadmintonSession'
import { BadmintonTopbar } from './BadmintonTopbar'
import type { BadmintonHand } from './BadmintonCore'
import './BadmintonGameScreen.css'

export default function BadmintonGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new SportsMotionTestProvider())
  const [session] = useState(() => new BadmintonSession(provider))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void session.start()

    const trigger = (hand: BadmintonHand, smash = false) => {
      provider.triggerSwing(hand, {
        timestampMs: session.getState().elapsedMs,
        vectorX: hand === 'LEFT' ? -0.82 : 0.82,
        vectorY: smash ? -0.72 : 0,
        intensity: smash ? 1 : 0.75,
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

  const triggerButton = (hand: BadmintonHand) => {
    provider.triggerSwing(hand, {
      timestampMs: session.getState().elapsedMs,
      vectorX: hand === 'LEFT' ? -0.82 : 0.82,
      vectorY: 0,
      intensity: 0.75,
    })
  }

  return (
    <main className="badminton-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <BadmintonTopbar state={state} onExit={onExit} developer />
      <section className="badminton-stage">
        <BadmintonCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <BadmintonResult state={state} onReplay={() => session.replay()} onExit={onExit} />
        ) : null}
      </section>
      <section className="badminton-test-controls" aria-label="羽球測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>Z / Q：左手揮拍　C / E：右手揮拍</small>
          <small>Shift + Z / C：強力 SMASH 測試</small>
        </div>
        <button type="button" onClick={() => triggerButton('LEFT')}>左手揮拍</button>
        <button type="button" onClick={() => triggerButton('RIGHT')}>右手揮拍</button>
      </section>
    </main>
  )
}
