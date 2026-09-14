import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { LocomotionTestProvider } from '../../motion/locomotion/LocomotionTestProvider'
import type { LocomotionStepSide } from '../../motion/contracts/locomotion'
import { RunningRaceCanvas } from './RunningRaceCanvas'
import { RunningRaceResult } from './RunningRaceResult'
import { RunningRaceSession } from './RunningRaceSession'
import { RunningRaceTopbar } from './RunningRaceTopbar'
import './RunningRaceGameScreen.css'

export default function RunningRaceGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new LocomotionTestProvider())
  const [session] = useState(() => new RunningRaceSession(provider))
  const testClockRef = useRef(0)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void session.start()
    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      const deltaMs = Math.max(0, time - previousTime)
      testClockRef.current += deltaMs
      provider.setIdle(testClockRef.current)
      session.tick(deltaMs, { setupReady: true, hardFailure: false })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(animationFrame)
      void session.stop()
    }
  }, [provider, session])

  const triggerStep = useCallback((side: LocomotionStepSide) => {
    // Leave two monotonically increasing samples for LocomotionTestProvider's
    // deterministic step synthesis when a button is pressed between frames.
    const timestampMs = Math.max(testClockRef.current + 2, state.elapsedMs + 2)
    testClockRef.current = timestampMs
    provider.triggerStep(side, { timestampMs, liftIntensity: 0.85 })
  }, [provider, state.elapsedMs])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const side = event.code === 'KeyA' || event.code === 'ArrowLeft'
        ? 'LEFT'
        : event.code === 'KeyD' || event.code === 'ArrowRight'
          ? 'RIGHT'
          : null
      if (!side) return
      event.preventDefault()
      event.stopImmediatePropagation()
      triggerStep(side)
    }
    window.addEventListener('keydown', handleKeyboard, true)
    return () => window.removeEventListener('keydown', handleKeyboard, true)
  }, [triggerStep])

  return (
    <main className="running-race-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <RunningRaceTopbar state={state} onExit={onExit} developer />
      <section className="running-race-stage">
        <RunningRaceCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <RunningRaceResult state={state} onReplay={() => session.replay()} onExit={onExit} />
        ) : null}
      </section>
      <section className="running-race-test-controls" aria-label="原地衝刺測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>A / ←：左腳抬膝　D / →：右腳抬膝</small>
          <small>左右交替觸發，速度會由 D0 節奏自然產生</small>
        </div>
        <button type="button" onClick={() => triggerStep('LEFT')}>左腳抬膝</button>
        <button type="button" onClick={() => triggerStep('RIGHT')}>右腳抬膝</button>
      </section>
    </main>
  )
}
