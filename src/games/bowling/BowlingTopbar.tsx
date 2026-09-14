import type { BowlingState } from './BowlingCore'

export function BowlingTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: BowlingState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="bowling-topbar">
      <button className="bowling-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="bowling-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'SPORTS MOTION · UPPER BODY'}</small>
        <h1>保齡球大賽 <span>Bowling</span></h1>
      </div>
      <div className="bowling-hud">
        <span>FRAME <strong>{Math.min(state.frameIndex + 1, 5)} / 5</strong></span>
        <span>ROLL <strong>{state.rollInFrame}</strong></span>
        <span>SCORE <strong>{state.score}</strong></span>
        <span>PINS <strong>{state.standingPinIds.length}</strong></span>
      </div>
    </header>
  )
}
