import { useEffect, useState, useSyncExternalStore } from 'react'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { RunnerCanvas } from './RunnerCanvas'
import { RunnerResult } from './RunnerResult'
import { RunnerSession } from './RunnerSession'
import { RunnerTopbar } from './RunnerTopbar'
import './RunnerGameScreen.css'

const RUNNER_ACTIONS = ['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'SQUAT'] as const

export default function RunnerGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new KeyboardMouseTestInputProvider({
    keyboardTarget: typeof window === 'undefined' ? new EventTarget() : window,
  }))
  const [session] = useState(() => new RunnerSession(provider))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void provider.start({
      players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }],
      actions: RUNNER_ACTIONS,
      sensors: { pose: false, hands: false, audio: false },
    }).then(() => session.start())

    const handleArrowControls = (event: KeyboardEvent) => {
      const action = event.code === 'ArrowLeft'
        ? 'MOVE_LEFT'
        : event.code === 'ArrowRight'
          ? 'MOVE_RIGHT'
          : event.code === 'ArrowUp' || event.code === 'Space'
            ? 'JUMP'
            : event.code === 'ArrowDown'
              ? 'SQUAT'
              : null
      if (!action) return
      event.preventDefault()
      provider.triggerAction('player-1', action)
    }
    window.addEventListener('keydown', handleArrowControls)

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
      window.removeEventListener('keydown', handleArrowControls)
      void session.stop()
      void provider.stop()
    }
  }, [provider, session])

  return (
    <main className="runner-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <RunnerTopbar state={state} onExit={onExit} developer />
      <section className="runner-stage">
        <RunnerCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <RunnerResult state={state} onReplay={() => session.replay()} onExit={onExit} />
        ) : null}
      </section>
      <section className="runner-test-controls" aria-label="跑酷動作測試控制">
        <div>
          <strong>鍵盤控制</strong>
          <small>←/A、→/D 換道，↑/Space/W 跳躍，↓/S 蹲下</small>
        </div>
        <button type="button" onClick={() => provider.triggerAction('player-1', 'MOVE_LEFT')}>← LEFT</button>
        <button type="button" onClick={() => provider.triggerAction('player-1', 'MOVE_RIGHT')}>RIGHT →</button>
        <button type="button" onClick={() => provider.triggerAction('player-1', 'JUMP')}>↑ JUMP</button>
        <button type="button" onClick={() => provider.triggerAction('player-1', 'SQUAT')}>↓ SQUAT</button>
      </section>
    </main>
  )
}
