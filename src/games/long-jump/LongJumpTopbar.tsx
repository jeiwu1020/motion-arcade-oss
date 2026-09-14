import type { LongJumpState } from './LongJumpCore'

export function LongJumpTopbar({
  state,
  onExit,
  developer = false,
}: {
  readonly state: LongJumpState
  readonly onExit: () => void
  readonly developer?: boolean
}) {
  return (
    <header className="long-jump-topbar" data-detected-steps={state.detectedGameSteps}>
      <button className="long-jump-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="long-jump-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'D0 LOCOMOTION + JUMP · FULL BODY STRICT'}</small>
        <h1>飛躍挑戰 <span>Long Jump</span></h1>
      </div>
      <div className="long-jump-hud">
        <span>嘗試 <strong>{Math.min(state.attemptIndex + 1, 3)} / 3</strong></span>
        <span>分數 <strong>{state.totalScore}</strong></span>
        <span>蓄力 <strong>{Math.round(state.charge * 100)}%</strong></span>
      </div>
    </header>
  )
}
