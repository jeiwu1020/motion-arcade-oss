import type { RunnerState } from './RunnerCore'

export function RunnerResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: RunnerState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  return (
    <div className="runner-result" role="dialog" aria-modal="true">
      <div className="runner-result-card">
        <p>RUNNER · 60 秒完成</p>
        <h2>衝線成功！</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>閃過障礙</dt><dd>{state.obstaclesCleared}</dd></div>
          <div><dt>碰撞</dt><dd>{state.collisions}</dd></div>
          <div><dt>最佳連勝</dt><dd>{state.bestStreak}</dd></div>
        </dl>
        <div className="runner-result-actions">
          <button type="button" onClick={onReplay}>再跑一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
