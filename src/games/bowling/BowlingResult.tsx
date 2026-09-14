import type { BowlingState } from './BowlingCore'

export function BowlingResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: BowlingState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  return (
    <div className="bowling-result" role="dialog" aria-modal="true">
      <div className="bowling-result-card">
        <p>ARCADE BOWLING · FIVE FRAMES</p>
        <h2>保齡球大賽完成！</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>總擊倒球瓶</dt><dd>{state.totalPinsKnocked}</dd></div>
          <div><dt>STRIKE</dt><dd>{state.strikes}</dd></div>
          <div><dt>SPARE</dt><dd>{state.spares}</dd></div>
          <div><dt>最佳連續 STRIKE</dt><dd>{state.bestStrikeStreak}</dd></div>
        </dl>
        <p className="bowling-hand-stats">
          左手投球 {state.leftHandRolls} · 右手投球 {state.rightHandRolls}
        </p>
        <div className="bowling-result-actions">
          <button type="button" onClick={onReplay}>再玩一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
