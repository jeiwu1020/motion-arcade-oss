import type { RhythmState } from './RhythmCore'

export function RhythmTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: RhythmState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="rhythm-topbar">
      <button className="rhythm-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="rhythm-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : '運動節奏 · UPPER BODY'}</small>
        <h1>節奏動一動</h1>
      </div>
      <div className="rhythm-hud">
        <span>分數 <strong>{state.score}</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        {state.currentCombo >= 2 ? <span>COMBO <strong>{state.currentCombo}</strong></span> : null}
      </div>
    </header>
  )
}
