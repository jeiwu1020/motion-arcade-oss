import type { BaseballState } from './BaseballCore'

export function BaseballResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: BaseballState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  return (
    <div className="baseball-result" role="dialog" aria-modal="true">
      <div className="baseball-result-card">
        <p>BASEBALL · 60 秒完成</p>
        <h2>打擊挑戰完成！</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>安打</dt><dd>{state.hits}</dd></div>
          <div><dt>MISS</dt><dd>{state.misses}</dd></div>
          <div><dt>HOME RUN</dt><dd>{state.homeRuns}</dd></div>
          <div><dt>最佳連續安打</dt><dd>{state.bestStreak}</dd></div>
        </dl>
        <div className="baseball-grades" aria-label="打擊判定統計">
          <span>PERFECT <b>{state.perfectCount}</b></span>
          <span>GREAT <b>{state.greatCount}</b></span>
          <span>GOOD <b>{state.goodCount}</b></span>
        </div>
        <p className="baseball-breakdown">
          一壘 {state.singles} · 二壘 {state.doubles} · 三壘 {state.triples}
        </p>
        <p className="baseball-hand-stats">
          左手安打 {state.leftHandHits} · 右手安打 {state.rightHandHits}
        </p>
        <div className="baseball-result-actions">
          <button type="button" onClick={onReplay}>再玩一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
