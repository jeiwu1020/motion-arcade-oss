import { useEffect, useState, useSyncExternalStore } from 'react'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { SoundCannonCanvas } from './SoundCannonCanvas'
import { SoundCannonResult } from './SoundCannonResult'
import { SoundCannonSession } from './SoundCannonSession'
import { SoundCannonTopbar } from './SoundCannonTopbar'
import './SoundCannonGameScreen.css'

const DEV_ACTIONS = ['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'] as const
export default function SoundCannonGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new KeyboardMouseTestInputProvider({ keyboardTarget: typeof window === 'undefined' ? new EventTarget() : window }))
  const [session] = useState(() => new SoundCannonSession(provider)); const [voiceLevel, setVoiceLevel] = useState(.35)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  useEffect(() => { let frame = 0; let previous = performance.now(); void provider.start({ players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }], actions: DEV_ACTIONS, sensors: { pose: false, hands: false, audio: false } }).then(() => session.start()); const loop = (time: number) => { const delta = Math.max(0, time - previous); provider.update(delta); session.tick(delta, { setupReady: true, hardFailure: false }); previous = time; frame = requestAnimationFrame(loop) }; frame = requestAnimationFrame(loop); return () => { cancelAnimationFrame(frame); void session.stop(); void provider.stop() } }, [provider, session])
  const setLevel = (value: number) => { const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); setVoiceLevel(next); provider.setContinuousValue('player-1', 'VOICE_LEVEL', next) }
  const startVoice = () => { setLevel(voiceLevel); provider.triggerAction('player-1', 'VOICE_TRIGGER') }
  const stopVoice = () => { setLevel(0); provider.setContinuousValue('player-1', 'VOICE_SUSTAINED_DURATION', 0) }
  return <main className="sound-cannon-shell" data-input-mode="test" data-presentation-mode="PLAYING"><SoundCannonTopbar state={state} onExit={onExit} developer /><section className="sound-cannon-stage"><SoundCannonCanvas session={session} />{state.phase === 'FINISHED' ? <SoundCannonResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}</section><section className="sound-cannon-test-controls" aria-label="音波砲測試控制"><div><strong>DEVELOPER TEST MODE</strong><small>選擇聲音等級，再開始短短發聲；V 可觸發</small></div><label>聲音 {Math.round(voiceLevel * 100)}<input aria-label="聲音能量" type="range" min="0" max="1" step=".01" value={voiceLevel} onChange={(event) => setLevel(Number(event.currentTarget.value))} /></label><button type="button" onClick={startVoice}>開始發聲</button><button type="button" onClick={stopVoice}>停止發聲</button></section></main>
}
