import type { BaseballState } from './BaseballCore'

export function BaseballTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: BaseballState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="baseball-topbar">
      <button className="baseball-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="baseball-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'SPORTS MOTION · UPPER BODY'}</small>
        <h1>全壘打王 <span>Baseball</span></h1>
      </div>
      <div className="baseball-hud">
        <span>分數 <strong>{state.score}</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        <span>連續 <strong>{state.currentStreak}</strong></span>
      </div>
    </header>
  )
}
