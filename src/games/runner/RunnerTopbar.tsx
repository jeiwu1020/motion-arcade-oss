import type { RunnerState } from './RunnerCore'

export function RunnerTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: RunnerState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="runner-topbar">
      <button className="runner-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="runner-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : '運動競技 · FULL BODY'}</small>
        <h1>跑酷衝刺</h1>
      </div>
      <div className="runner-hud">
        <span>分數 <strong>{state.score}</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        {state.currentStreak >= 2 ? <span>連勝 <strong>{state.currentStreak}</strong></span> : null}
      </div>
    </header>
  )
}
