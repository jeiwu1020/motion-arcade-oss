import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { SwimmingCanvas } from './SwimmingCanvas'
import { SwimmingResult } from './SwimmingResult'
import { SwimmingSession } from './SwimmingSession'
import { SwimmingTopbar } from './SwimmingTopbar'
import type { SwimmingStrokeSide } from './SwimmingCore'
import './SwimmingGameScreen.css'

export default function SwimmingGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new SportsMotionTestProvider())
  const [session] = useState(() => new SwimmingSession(provider))
  const clockRef = useRef(0)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void session.start()
    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      const deltaMs = Math.max(0, time - previousTime)
      clockRef.current += deltaMs
      session.tick(deltaMs, { setupReady: true, hardFailure: false })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(animationFrame)
      void session.stop()
    }
  }, [session])

  const triggerStroke = useCallback((side: SwimmingStrokeSide, strong = false) => {
    provider.triggerSwing(side, {
      timestampMs: clockRef.current,
      vectorX: side === 'LEFT' ? -0.82 : 0.82,
      vectorY: side === 'LEFT' ? -0.45 : 0.45,
      intensity: strong ? 1 : 0.7,
    })
  }, [provider])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const side = event.code === 'KeyZ' || event.code === 'KeyQ'
        ? 'LEFT'
        : event.code === 'KeyC' || event.code === 'KeyE'
          ? 'RIGHT'
          : null
      if (!side) return
      event.preventDefault()
      event.stopImmediatePropagation()
      triggerStroke(side, event.shiftKey)
    }
    window.addEventListener('keydown', handleKeyboard, true)
    return () => window.removeEventListener('keydown', handleKeyboard, true)
  }, [triggerStroke])

  return (
    <main className="swimming-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <SwimmingTopbar state={state} onExit={onExit} developer />
      <section className="swimming-stage">
        <SwimmingCanvas session={session} />
        {state.phase === 'FINISHED' ? <SwimmingResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}
      </section>
      <section className="swimming-test-controls" aria-label="泳池衝刺測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>Z / Q：左手划水　C / E：右手划水</small>
          <small>左右交替產生推進；Shift + 按鍵為強力划水</small>
        </div>
        <button type="button" onClick={() => triggerStroke('LEFT')}>左手划水</button>
        <button type="button" onClick={() => triggerStroke('RIGHT')}>右手划水</button>
      </section>
    </main>
  )
}
