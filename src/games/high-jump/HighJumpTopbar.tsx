import type { HighJumpState } from './HighJumpCore'

export function HighJumpTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: HighJumpState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="high-jump-topbar" data-current-stage={state.currentStage}>
      <button className="high-jump-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="high-jump-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'JUMP · FULL BODY STRICT'}</small>
        <h1>跳高挑戰 <span>High Jump</span></h1>
      </div>
      <div className="high-jump-hud">
        <span>關卡 <strong>{state.currentStage} / 5</strong></span>
        <span>分數 <strong>{state.score}</strong></span>
        {developer ? <span>已過 <strong>{state.barsCleared}</strong></span> : null}
      </div>
    </header>
  )
}
