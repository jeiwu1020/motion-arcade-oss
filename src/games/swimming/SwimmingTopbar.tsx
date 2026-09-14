import type { SwimmingState } from './SwimmingCore'

export function SwimmingTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: SwimmingState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="swimming-topbar" data-accepted-strokes={state.acceptedStrokeCount}>
      <button className="swimming-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="swimming-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'SPORTS MOTION · UPPER BODY'}</small>
        <h1>泳池衝刺 <span>Swimming</span></h1>
      </div>
      <div className="swimming-hud">
        <span>速度 <strong>{state.speedMeter}</strong></span>
        <span>名次 <strong>第 {state.playerRank} 名</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        {developer ? <span>划水 <strong>{state.acceptedStrokeCount}</strong></span> : null}
      </div>
    </header>
  )
}
