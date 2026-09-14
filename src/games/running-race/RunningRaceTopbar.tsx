import type { RunningRaceState } from './RunningRaceCore'

export function RunningRaceTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: RunningRaceState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="running-race-topbar" data-game-steps={state.gameSteps}>
      <button className="running-race-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="running-race-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'LOCOMOTION · FULL BODY + KNEES'}</small>
        <h1>原地衝刺王 <span>Running Race</span></h1>
      </div>
      <div className="running-race-hud">
        <span>速度 <strong>{state.speedMeter}</strong></span>
        <span>名次 <strong>第 {state.playerRank} 名</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        {developer ? <span>步數 <strong>{state.gameSteps}</strong></span> : null}
      </div>
    </header>
  )
}
