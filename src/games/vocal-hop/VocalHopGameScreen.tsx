import { useEffect, useState, useSyncExternalStore } from 'react'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { VocalHopCanvas } from './VocalHopCanvas'
import { VocalHopResult } from './VocalHopResult'
import { VocalHopSession } from './VocalHopSession'
import { VocalHopTopbar } from './VocalHopTopbar'
import './VocalHopGameScreen.css'

const VOCAL_HOP_DEV_ACTIONS = ['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'] as const

export default function VocalHopGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new KeyboardMouseTestInputProvider({
    keyboardTarget: typeof window === 'undefined' ? new EventTarget() : window,
  }))
  const [session] = useState(() => new VocalHopSession(provider))
  const [voiceLevel, setVoiceLevel] = useState(0)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    let animationFrame = 0
    let previousTime = performance.now()
    void provider.start({
      players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }],
      actions: VOCAL_HOP_DEV_ACTIONS,
      sensors: { pose: false, hands: false, audio: false },
    }).then(() => session.start())
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
      void session.stop()
      void provider.stop()
    }
  }, [provider, session])

  const setLevel = (value: number) => {
    const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
    setVoiceLevel(next)
    provider.setContinuousValue('player-1', 'VOICE_LEVEL', next)
  }
  const trigger = () => provider.triggerAction('player-1', 'VOICE_TRIGGER')

  return (
    <main className="vocal-hop-shell" data-input-mode="test" data-presentation-mode="PLAYING">
      <VocalHopTopbar state={state} onExit={onExit} developer />
      <section className="vocal-hop-stage">
        <VocalHopCanvas session={session} />
        {state.phase === 'FINISHED' ? <VocalHopResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}
      </section>
      <section className="vocal-hop-test-controls" aria-label="聲控跳跳樂測試控制">
        <div>
          <strong>Developer Test Mode</strong>
          <small>V：聲音觸發　滑桿或「發聲」調整聲音能量</small>
          <small>舒服的聲音就能跳，不需要大喊</small>
        </div>
        <label>聲音 {Math.round(voiceLevel * 100)}<input aria-label="聲音能量" type="range" min="0" max="1" step="0.01" value={voiceLevel} onChange={(event) => setLevel(Number(event.currentTarget.value))} /></label>
        <button type="button" onClick={() => setLevel(0.35)}>發聲</button>
        <button type="button" onClick={() => setLevel(0)}>停止</button>
        <button type="button" onClick={trigger}>觸發跳躍</button>
      </section>
    </main>
  )
}
