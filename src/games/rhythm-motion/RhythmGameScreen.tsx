import { useEffect, useState, useSyncExternalStore } from 'react'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { RhythmCanvas } from './RhythmCanvas'
import { RhythmResult } from './RhythmResult'
import { RhythmSession } from './RhythmSession'
import { RhythmTopbar } from './RhythmTopbar'
import type { RhythmAction } from './RhythmCore'
import './RhythmGameScreen.css'

const RHYTHM_ACTIONS = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'REACH_LEFT',
  'REACH_RIGHT',
] as const

const PROVIDER_ACTION: Readonly<Record<RhythmAction, 'MOVE_LEFT' | 'MOVE_RIGHT' | 'REACH_LEFT' | 'REACH_RIGHT'>> = {
  LEFT: 'MOVE_LEFT',
  RIGHT: 'MOVE_RIGHT',
  REACH_LEFT: 'REACH_LEFT',
  REACH_RIGHT: 'REACH_RIGHT',
}

export default function RhythmGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new KeyboardMouseTestInputProvider({
    keyboardTarget: typeof window === 'undefined' ? new EventTarget() : window,
  }))
  const [session] = useState(() => new RhythmSession(provider))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void provider.start({
      players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['UPPER_BODY']) }],
      actions: RHYTHM_ACTIONS,
      sensors: { pose: false, hands: false, audio: false },
    }).then(() => session.start())

    const handleKeyboard = (event: KeyboardEvent) => {
      const action: RhythmAction | null = event.code === 'ArrowLeft'
        ? 'LEFT'
        : event.code === 'ArrowRight'
          ? 'RIGHT'
          : event.code === 'KeyQ'
            ? 'REACH_LEFT'
            : event.code === 'KeyE'
              ? 'REACH_RIGHT'
              : null
      if (!action) return
      event.preventDefault()
      event.stopImmediatePropagation()
      provider.triggerAction('player-1', PROVIDER_ACTION[action])
    }
    window.addEventListener('keydown', handleKeyboard, true)

    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      const deltaMs = time - previousTime
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

  const trigger = (action: RhythmAction) => provider.triggerAction('player-1', PROVIDER_ACTION[action])

  return (
    <main className="rhythm-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <RhythmTopbar state={state} onExit={onExit} developer />
      <section className="rhythm-stage">
        <RhythmCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <RhythmResult
            state={state}
            onReplay={() => session.replay()}
            onExit={onExit}
            showTimingDiagnostics
          />
        ) : null}
      </section>
      <section className="rhythm-test-controls" aria-label="節奏動作測試控制">
        <div>
          <strong>鍵盤控制</strong>
          <small>←/A、→/D 移動，Z/Q 左手，C/E 右手</small>
        </div>
        <button type="button" onClick={() => trigger('LEFT')}>← LEFT</button>
        <button type="button" onClick={() => trigger('RIGHT')}>RIGHT →</button>
        <button type="button" onClick={() => trigger('REACH_LEFT')}>↙ REACH LEFT</button>
        <button type="button" onClick={() => trigger('REACH_RIGHT')}>REACH RIGHT ↘</button>
      </section>
    </main>
  )
}
