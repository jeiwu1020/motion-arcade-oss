import { useEffect, useState, useSyncExternalStore } from 'react'

import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { BalloonPopCanvas } from './BalloonPopCanvas'
import {
  BALLOON_POP_PLAYER_ID,
  BalloonPopSession,
} from './BalloonPopSession'
import './BalloonPopGameScreen.css'

interface BalloonPopGameScreenProps {
  readonly onExit: () => void
}

export default function BalloonPopGameScreen({ onExit }: BalloonPopGameScreenProps) {
  const [provider] = useState(
    () => new KeyboardMouseTestInputProvider({ keyboardTarget: window }),
  )
  const [session] = useState(() => new BalloonPopSession(provider))
  const state = useSyncExternalStore(
    session.subscribe,
    session.getState,
    session.getState,
  )

  useEffect(() => {
    let cancelled = false
    let animationFrame = 0
    let previousTime = performance.now()

    const frame = (time: number) => {
      session.tick(time - previousTime)
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }

    void session.start().then(() => {
      if (cancelled) {
        return
      }
      previousTime = performance.now()
      animationFrame = requestAnimationFrame(frame)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      void session.stop()
    }
  }, [session])

  const secondsRemaining = Math.ceil(state.roundRemainingMs / 1_000)
  const trigger = (action: 'REACH_LEFT' | 'REACH_RIGHT') => {
    provider.triggerAction(BALLOON_POP_PLAYER_ID, action)
  }

  return (
    <main className="balloon-pop-shell">
      <header className="balloon-pop-topbar">
        <button className="balloon-pop-home" type="button" onClick={onExit}>
          ← 回首頁
        </button>
        <div>
          <span>小遊戲</span>
          <h1>氣球拍拍樂</h1>
        </div>
        <div className="balloon-pop-hud" aria-label="遊戲狀態">
          <span>分數 <strong>{state.score}</strong></span>
          <span>時間 <strong>{secondsRemaining}</strong></span>
        </div>
      </header>

      <section className="balloon-pop-stage">
        <BalloonPopCanvas session={session} />
        {state.phase === 'FINISHED' ? (
          <div className="balloon-pop-result" role="dialog" aria-modal="true">
            <div className="balloon-pop-result-card">
              <p>ROUND COMPLETE</p>
              <h2>完成！</h2>
              <strong className="balloon-pop-final-score">{state.score} 分</strong>
              <dl>
                <div><dt>命中</dt><dd>{state.hits}</dd></div>
                <div><dt>錯過</dt><dd>{state.misses}</dd></div>
              </dl>
              <div className="balloon-pop-result-actions">
                <button type="button" onClick={() => session.replay()}>再玩一次</button>
                <button type="button" onClick={onExit}>回到首頁</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="balloon-pop-test-controls" aria-label="測試動作控制">
        <div>
          <span>TEST MOTION PROVIDER</span>
          <small>鍵盤 Z / C，或按下左右按鈕</small>
        </div>
        <button type="button" onClick={() => trigger('REACH_LEFT')}>
          <kbd>Z</kbd> 左手伸出
        </button>
        <button type="button" onClick={() => trigger('REACH_RIGHT')}>
          右手伸出 <kbd>C</kbd>
        </button>
      </section>
    </main>
  )
}
