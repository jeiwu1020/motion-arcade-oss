import { useEffect, useState, useSyncExternalStore } from 'react'

import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { ReactionArenaAudio } from './ReactionArenaAudio'
import { ReactionArenaCanvas } from './ReactionArenaCanvas'
import { ReactionArenaSession } from './ReactionArenaSession'
import './ReactionArenaGameScreen.css'

export default function ReactionArenaGameScreen({ onExit }: { readonly onExit: () => void }) {
  const [provider] = useState(() => new KeyboardMouseTestInputProvider({ keyboardTarget: window }))
  const [session] = useState(() => new ReactionArenaSession(provider))
  const [audio] = useState(() => new ReactionArenaAudio())
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    void provider.start({ players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }], actions: ['MOVE_LEFT', 'MOVE_RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT'], sensors: { pose: false, hands: false, audio: false } }).then(() => session.start())
    const handleArrow = (event: KeyboardEvent) => {
      const action = event.code === 'ArrowLeft'
        ? 'MOVE_LEFT'
        : event.code === 'ArrowRight'
          ? 'MOVE_RIGHT'
          : event.code === 'ArrowDown'
            ? 'SQUAT'
            : null
      if (action) {
        event.preventDefault()
        provider.triggerAction('player-1', action)
      }
    }
    window.addEventListener('keydown', handleArrow)
    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      const delta = time - previousTime
      provider.update(delta)
      session.tick(delta, { setupReady: true, hardFailure: false })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener('keydown', handleArrow); void session.stop(); void provider.stop(); void audio.dispose() }
  }, [audio, provider, session])

  const secondsRemaining = Math.ceil(state.roundRemainingMs / 1_000)
  return <main className="reaction-arena-shell" data-input-mode="test">
    <header className="reaction-arena-topbar"><button className="reaction-arena-home" type="button" onClick={onExit}>← 回首頁</button><div><small>DEVELOPER TEST MODE</small><h1>光速反應王</h1></div><div className="reaction-arena-hud"><span>分數 <strong>{state.score}</strong></span><span>時間 <strong>{secondsRemaining}</strong></span></div></header>
    <section className="reaction-arena-stage"><ReactionArenaCanvas session={session} audio={audio} /></section>
    <section className="reaction-arena-test-controls" aria-label="反應動作測試控制"><div><strong>鍵盤控制</strong><small>←/→ 左右，Z/C 伸手，↓ 或 S 蹲下</small></div><button type="button" onClick={() => provider.triggerAction('player-1', 'MOVE_LEFT')}>← LEFT</button><button type="button" onClick={() => provider.triggerAction('player-1', 'MOVE_RIGHT')}>RIGHT →</button><button type="button" onClick={() => provider.triggerAction('player-1', 'REACH_LEFT')}>Z 左手</button><button type="button" onClick={() => provider.triggerAction('player-1', 'REACH_RIGHT')}>C 右手</button><button type="button" onClick={() => provider.triggerAction('player-1', 'SQUAT')}>↓ SQUAT</button></section>
  </main>
}
