import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { MicrophoneVoiceInputProvider } from '../../motion/providers/MicrophoneVoiceInputProvider'
import { SoundCannonCanvas } from './SoundCannonCanvas'
import { SoundCannonResult } from './SoundCannonResult'
import { SoundCannonSession } from './SoundCannonSession'
import { SoundCannonTopbar } from './SoundCannonTopbar'
import './SoundCannonGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const SOUND_CANNON_VOICE_INPUT_REQUEST = Object.freeze({ players: Object.freeze([{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }]), actions: Object.freeze(['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'] as const), sensors: Object.freeze({ pose: false, hands: false, audio: true }) })
type MicrophoneStatus = 'NOT_STARTED' | 'STARTING' | 'RUNNING' | 'NEEDS_RESTART' | 'ERROR'

export default function SoundCannonVoiceGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new MicrophoneVoiceInputProvider()); const [session] = useState(() => new SoundCannonSession(provider)); const [status, setStatus] = useState<MicrophoneStatus>('NOT_STARTED'); const [error, setError] = useState<string | null>(null); const statusRef = useRef(status); useEffect(() => { statusRef.current = status }, [status]); const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  useEffect(() => { let cancelled = false; let frame = 0; let previous = performance.now(); const unsubscribe = provider.subscribe(() => { if (!cancelled && statusRef.current === 'RUNNING' && !provider.isRunning()) setStatus('NEEDS_RESTART') }); void session.start(); const loop = (time: number) => { const delta = Math.max(0, time - previous); provider.update(delta); session.tick(delta, { setupReady: statusRef.current === 'RUNNING' && provider.isRunning(), hardFailure: statusRef.current === 'ERROR' || statusRef.current === 'NEEDS_RESTART' }); previous = time; frame = requestAnimationFrame(loop) }; frame = requestAnimationFrame(loop); return () => { cancelled = true; cancelAnimationFrame(frame); unsubscribe(); void Promise.all([session.stop(), provider.dispose()]) } }, [provider, session])
  const startMicrophone = useCallback(() => { if (status === 'STARTING' || status === 'RUNNING') return; setStatus('STARTING'); setError(null); void provider.start(SOUND_CANNON_VOICE_INPUT_REQUEST).then(() => setStatus('RUNNING')).catch((reason: unknown) => { setStatus('ERROR'); setError(reason instanceof Error ? reason.message : '麥克風無法啟用，請稍後重試。') }) }, [provider, status])
  const needs = status !== 'RUNNING'
  return <main className="sound-cannon-shell" data-input-mode="voice" data-presentation-mode={state.phase === 'FINISHED' ? 'RESULT' : needs ? 'SETUP' : 'PLAYING'}><SoundCannonTopbar state={state} onExit={onExit} /><section className="sound-cannon-stage"><SoundCannonCanvas session={session} />{state.phase === 'FINISHED' ? <SoundCannonResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}{state.phase !== 'FINISHED' && needs ? <div className="sound-cannon-mic-setup" role="dialog" aria-label="啟用麥克風"><div className="sound-cannon-mic-card"><h2>準備好發射音波了嗎？</h2><p>發出短短、舒服的聲音幫音波砲蓄力，不必大喊。</p><p>只即時分析聲音大小，不錄音、不儲存、不辨識內容。</p>{error ? <p role="alert">{error}</p> : null}<button className="sound-cannon-mic-button" type="button" onClick={startMicrophone} disabled={status === 'STARTING'}>{status === 'STARTING' ? '啟用中…' : status === 'NEEDS_RESTART' ? '重新啟用麥克風' : '啟用麥克風開始'}</button></div></div> : null}</section></main>
}
