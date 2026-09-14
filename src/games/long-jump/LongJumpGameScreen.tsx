import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { LocomotionTestProvider } from '../../motion/locomotion/LocomotionTestProvider'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { LongJumpCanvas } from './LongJumpCanvas'
import { LongJumpResult } from './LongJumpResult'
import { LongJumpSession } from './LongJumpSession'
import { LongJumpTopbar } from './LongJumpTopbar'
import './LongJumpGameScreen.css'

const LONG_JUMP_ACTIONS = ['JUMP'] as const

export default function LongJumpGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [locomotion] = useState(() => new LocomotionTestProvider())
  const [provider] = useState(() => new KeyboardMouseTestInputProvider({
    keyboardTarget: typeof window === 'undefined' ? new EventTarget() : window,
  }))
  const [session] = useState(() => new LongJumpSession(locomotion, provider))
  const testClockRef = useRef(0)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  const triggerStep = useCallback((side: 'LEFT' | 'RIGHT') => {
    const timestampMs = Math.max(testClockRef.current + 2, state.elapsedMs + 2)
    testClockRef.current = timestampMs
    locomotion.triggerStep(side, { timestampMs, liftIntensity: 0.85 })
  }, [locomotion, state.elapsedMs])

  useEffect(() => {
    let cancelled = false
    void provider.start({
      players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }],
      actions: LONG_JUMP_ACTIONS,
      sensors: { pose: false, hands: false, audio: false },
    }).then(() => {
      if (!cancelled) void session.start()
    })

    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      const deltaMs = Math.max(0, time - previousTime)
      testClockRef.current += deltaMs
      provider.update(deltaMs)
      locomotion.setIdle(testClockRef.current)
      session.tick(deltaMs, { setupReady: true, hardFailure: false })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      void session.stop()
      void provider.stop()
    }
  }, [locomotion, provider, session])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        event.preventDefault()
        event.stopImmediatePropagation()
        triggerStep('LEFT')
        return
      }
      if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        event.preventDefault()
        event.stopImmediatePropagation()
        triggerStep('RIGHT')
        return
      }
      if (event.code !== 'Space' && event.code !== 'KeyW' && event.code !== 'ArrowUp') return
      event.preventDefault()
      event.stopImmediatePropagation()
      provider.triggerAction('player-1', 'JUMP')
    }
    window.addEventListener('keydown', handleKeyboard, true)
    return () => window.removeEventListener('keydown', handleKeyboard, true)
  }, [provider, triggerStep])

  const triggerLeft = () => triggerStep('LEFT')
  const triggerRight = () => triggerStep('RIGHT')
  const triggerJump = () => provider.triggerAction('player-1', 'JUMP')

  return (
    <main className="long-jump-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <LongJumpTopbar state={state} onExit={onExit} developer />
      <section className="long-jump-stage">
        <LongJumpCanvas session={session} />
        {state.phase === 'FINISHED' ? <LongJumpResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}
      </section>
      <section className="long-jump-test-controls" aria-label="飛躍挑戰測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>A / ←：左腳抬膝　D / →：右腳抬膝　Space / W / ↑：跳躍</small>
          <small>原地抬膝蓄力，看到起跳提示後輕輕向上跳即可。不要往前跳。</small>
        </div>
        <div className="long-jump-test-buttons">
          <button type="button" onClick={triggerLeft}>左腳抬膝</button>
          <button type="button" onClick={triggerRight}>右腳抬膝</button>
          <button type="button" onClick={triggerJump}>跳躍</button>
        </div>
      </section>
    </main>
  )
}
