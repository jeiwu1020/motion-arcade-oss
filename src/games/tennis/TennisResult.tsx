import type { TennisState } from './TennisCore'

export function TennisResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: TennisState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  return (
    <div className="tennis-result" role="dialog" aria-modal="true">
      <div className="tennis-result-card">
        <p>TENNIS · 60 秒完成</p>
        <h2>對決完成！</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>成功回球</dt><dd>{state.returns}</dd></div>
          <div><dt>漏接</dt><dd>{state.misses}</dd></div>
          <div><dt>最佳 RALLY</dt><dd>{state.bestRally}</dd></div>
        </dl>
        <div className="tennis-grades" aria-label="網球判定統計">
          <span>PERFECT <b>{state.perfectCount}</b></span>
          <span>GREAT <b>{state.greatCount}</b></span>
          <span>GOOD <b>{state.goodCount}</b></span>
        </div>
        <p className="tennis-hand-stats">
          左手回球 {state.leftHandReturns} · 右手回球 {state.rightHandReturns}
        </p>
        <div className="tennis-result-actions">
          <button type="button" onClick={onReplay}>再玩一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
