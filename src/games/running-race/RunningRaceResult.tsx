import type { RunningRaceState } from './RunningRaceCore'

export function RunningRaceResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: RunningRaceState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  return (
    <div className="running-race-result" role="dialog" aria-modal="true">
      <div className="running-race-result-card">
        <p>RUNNING RACE · 60 秒完成</p>
        <h2>第 {state.finalPlace} 名</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>最佳速度等級</dt><dd>{state.peakSpeedMeter}</dd></div>
          <div><dt>平均速度等級</dt><dd>{Math.round(state.averageSpeedMeter)}</dd></div>
          <div><dt>超車次數</dt><dd>{state.overtakes}</dd></div>
          <div><dt>遊戲步數</dt><dd>{state.gameSteps}</dd></div>
          <div><dt>最終排名</dt><dd>第 {state.finalPlace} 名</dd></div>
          <div><dt>60 秒完成</dt><dd>完成</dd></div>
        </dl>
        <div className="running-race-result-actions">
          <button type="button" onClick={onReplay}>再跑一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
