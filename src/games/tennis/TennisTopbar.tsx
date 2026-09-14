import type { TennisState } from './TennisCore'

export function TennisTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: TennisState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="tennis-topbar">
      <button className="tennis-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="tennis-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'SPORTS MOTION · UPPER BODY'}</small>
        <h1>網球對決 <span>Tennis</span></h1>
      </div>
      <div className="tennis-hud">
        <span>分數 <strong>{state.score}</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        <span>RALLY <strong>{state.currentRally}</strong></span>
      </div>
    </header>
  )
}
