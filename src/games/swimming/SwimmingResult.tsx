import type { SwimmingState } from './SwimmingCore'

export function SwimmingResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: SwimmingState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  return (
    <div className="swimming-result" role="dialog" aria-modal="true">
      <div className="swimming-result-card">
        <p>SWIMMING · 60 秒完成</p>
        <h2>最終第 {state.finalPlace} 名</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>最佳速度等級</dt><dd>{state.peakSpeedMeter}</dd></div>
          <div><dt>平均速度等級</dt><dd>{Math.round(state.averageSpeedMeter)}</dd></div>
          <div><dt>超越次數</dt><dd>{state.overtakes}</dd></div>
          <div><dt>偵測划水</dt><dd>{state.acceptedStrokeCount}</dd></div>
          <div><dt>最佳交替節奏</dt><dd>{state.bestAlternatingStreak}</dd></div>
          <div><dt>左／右手</dt><dd>{state.leftStrokeCount} / {state.rightStrokeCount}</dd></div>
        </dl>
        <p className="swimming-result-note">以上為遊戲內速度與進度，不代表真實游泳距離或運動量。</p>
        <div className="swimming-result-actions">
          <button type="button" onClick={onReplay}>再游一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
