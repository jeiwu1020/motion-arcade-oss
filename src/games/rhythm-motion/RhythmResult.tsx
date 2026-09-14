import type { RhythmState } from './RhythmCore'

export function RhythmResult({
  state,
  onReplay,
  onExit,
  showTimingDiagnostics = false,
}: {
  readonly state: RhythmState
  readonly onReplay: () => void
  readonly onExit: () => void
  readonly showTimingDiagnostics?: boolean
}) {
  return (
    <div className="rhythm-result" role="dialog" aria-modal="true">
      <div className="rhythm-result-card">
        <p>RHYTHM MOTION · 60 秒完成</p>
        <h2>節奏完成！</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>成功音符</dt><dd>{state.successfulNotes}</dd></div>
          <div><dt>漏接</dt><dd>{state.missedNotes}</dd></div>
          <div><dt>最佳 COMBO</dt><dd>{state.bestCombo}</dd></div>
        </dl>
        <div className="rhythm-grades" aria-label="節奏判定統計">
          <span>PERFECT <b>{state.perfectCount}</b></span>
          <span>GREAT <b>{state.greatCount}</b></span>
          <span>GOOD <b>{state.goodCount}</b></span>
        </div>
        {showTimingDiagnostics ? (
          <p className="rhythm-timing-diagnostics">
            節奏準度：平均絕對偏移 {state.meanAbsoluteHitOffsetMs} ms · 提前 {state.earlyHitCount} · 延後 {state.lateHitCount}
          </p>
        ) : null}
        <div className="rhythm-result-actions">
          <button type="button" onClick={onReplay}>再玩一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
