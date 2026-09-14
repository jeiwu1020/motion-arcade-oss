import type { BadmintonState } from './BadmintonCore'

export function BadmintonTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: BadmintonState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="badminton-topbar">
      <button className="badminton-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="badminton-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'SPORTS MOTION · UPPER BODY'}</small>
        <h1>羽球快打 <span>Badminton</span></h1>
      </div>
      <div className="badminton-hud">
        <span>分數 <strong>{state.score}</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        <span>RALLY <strong>{state.currentRally}</strong></span>
      </div>
    </header>
  )
}
