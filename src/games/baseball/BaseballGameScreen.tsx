import { useEffect, useState, useSyncExternalStore } from 'react'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { BaseballCanvas } from './BaseballCanvas'
import type { BaseballHand } from './BaseballCore'
import { BaseballResult } from './BaseballResult'
import { BaseballSession } from './BaseballSession'
import { BaseballTopbar } from './BaseballTopbar'
import './BaseballGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export function baseballDeveloperSwingIntensity(strong: boolean): number {
  return strong ? 1 : 0.72
}

export default function BaseballGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new SportsMotionTestProvider())
  const [session] = useState(() => new BaseballSession(provider))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void session.start()
    const trigger = (hand: BaseballHand, strong = false) => {
      provider.triggerSwing(hand, {
        timestampMs: session.getState().elapsedMs,
        vectorX: hand === 'LEFT' ? -0.72 : 0.72,
        vectorY: -0.15,
        intensity: baseballDeveloperSwingIntensity(strong),
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

  const triggerButton = (hand: BaseballHand) => {
    provider.triggerSwing(hand, {
      timestampMs: session.getState().elapsedMs,
      vectorX: hand === 'LEFT' ? -0.72 : 0.72,
      vectorY: -0.15,
      intensity: baseballDeveloperSwingIntensity(false),
    })
  }

  return (
    <main className="baseball-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <BaseballTopbar state={state} onExit={onExit} developer />
      <section className="baseball-stage">
        <BaseballCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <BaseballResult state={state} onReplay={() => session.replay()} onExit={onExit} />
        ) : null}
      </section>
      <section className="baseball-test-controls" aria-label="棒球測試控制">
        <div>
          <strong>DEVELOPER TEST MODE</strong>
          <small>Z / Q：左手　C / E：右手　Shift：強力測試揮棒</small>
        </div>
        <button type="button" onClick={() => triggerButton('LEFT')}>左手揮棒</button>
        <button type="button" onClick={() => triggerButton('RIGHT')}>右手揮棒</button>
      </section>
    </main>
  )
}
