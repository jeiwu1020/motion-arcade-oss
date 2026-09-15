import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { MicrophoneVoiceInputProvider } from '../../motion/providers/MicrophoneVoiceInputProvider'
import { VocalHopCanvas } from './VocalHopCanvas'
import { VocalHopResult } from './VocalHopResult'
import { VocalHopSession } from './VocalHopSession'
import { VocalHopTopbar } from './VocalHopTopbar'
import './VocalHopGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const VOCAL_HOP_VOICE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['STANDARD']),
  }]),
  actions: Object.freeze(['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'] as const),
  sensors: Object.freeze({ pose: false, hands: false, audio: true }),
})

type MicrophoneStatus = 'NOT_STARTED' | 'STARTING' | 'RUNNING' | 'NEEDS_RESTART' | 'ERROR'

export default function VocalHopVoiceGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new MicrophoneVoiceInputProvider())
  const [session] = useState(() => new VocalHopSession(provider))
  const [status, setStatus] = useState<MicrophoneStatus>('NOT_STARTED')
  const [error, setError] = useState<string | null>(null)
  const statusRef = useRef<MicrophoneStatus>(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    let cancelled = false
    let animationFrame = 0
    let previousTime = performance.now()
    const unsubscribe = provider.subscribe(() => {
      if (!cancelled && statusRef.current === 'RUNNING' && !provider.isRunning()) setStatus('NEEDS_RESTART')
    })
    void session.start()
    const frame = (time: number) => {
      const deltaMs = Math.max(0, time - previousTime)
      provider.update(deltaMs)
      session.tick(deltaMs, {
        setupReady: statusRef.current === 'RUNNING' && provider.isRunning(),
        hardFailure: statusRef.current === 'ERROR' || statusRef.current === 'NEEDS_RESTART',
      })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      unsubscribe()
      void Promise.all([session.stop(), provider.dispose()])
    }
  }, [provider, session])

  const startMicrophone = useCallback(() => {
    if (status === 'STARTING' || status === 'RUNNING') return
    setStatus('STARTING')
    setError(null)
    void provider.start(VOCAL_HOP_VOICE_INPUT_REQUEST).then(() => {
      setStatus('RUNNING')
    }).catch((reason: unknown) => {
      setStatus('ERROR')
      setError(reason instanceof Error ? reason.message : '麥克風無法啟用，請稍後重試。')
    })
  }, [provider, status])

  const needsMicrophone = status !== 'RUNNING'
  return (
    <main className="vocal-hop-shell" data-input-mode="voice" data-presentation-mode={state.phase === 'FINISHED' ? 'RESULT' : needsMicrophone ? 'SETUP' : 'PLAYING'}>
      <VocalHopTopbar state={state} onExit={onExit} />
      <section className="vocal-hop-stage">
        <VocalHopCanvas session={session} />
        {state.phase === 'FINISHED' ? <VocalHopResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}
        {state.phase !== 'FINISHED' && needsMicrophone ? (
          <div className="vocal-hop-mic-setup" role="dialog" aria-label="啟用麥克風">
            <div className="vocal-hop-mic-card">
              <h2>準備好用聲音跳躍了嗎？</h2>
              <p>發出舒服的聲音讓角色跳起來，聲音清楚就可以，不必大喊。</p>
              <p>僅即時分析聲音大小，不錄音、不儲存，也不辨識說話內容。</p>
              {error ? <p className="vocal-hop-mic-error">{error}</p> : null}
              <button className="vocal-hop-mic-button" type="button" onClick={startMicrophone} disabled={status === 'STARTING'}>
                {status === 'STARTING' ? '啟用中…' : status === 'NEEDS_RESTART' ? '重新啟用麥克風' : '啟用麥克風開始'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
