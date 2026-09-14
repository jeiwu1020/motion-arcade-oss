import type { LongJumpState } from './LongJumpCore'

export function LongJumpResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: LongJumpState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  const result = state.finalResult
  return (
    <div className="long-jump-result" role="dialog" aria-modal="true">
      <div className="long-jump-result-card">
        <p>LONG JUMP · ARCADE CHALLENGE</p>
        <h2>三次挑戰完成</h2>
        <strong>{result?.totalScore ?? state.totalScore} 分</strong>
        <dl>
          <div><dt>最佳遊戲距離</dt><dd>{result?.bestArcadeDistance ?? state.bestArcadeDistance}</dd></div>
          <div><dt>平均遊戲距離</dt><dd>{Math.round(result?.averageArcadeDistance ?? state.averageArcadeDistance)}</dd></div>
          <div><dt>最佳蓄力</dt><dd>{Math.round((result?.bestCharge ?? state.bestCharge) * 100)}%</dd></div>
          <div><dt>PERFECT</dt><dd>{result?.perfectCount ?? state.perfectCount}</dd></div>
          <div><dt>偵測步數</dt><dd>{result?.detectedGameSteps ?? state.detectedGameSteps}</dd></div>
          <div><dt>未起跳</dt><dd>{result?.noJumpCount ?? state.noJumpCount}</dd></div>
        </dl>
        <p className="long-jump-result-note">遊戲距離是虛構的遊戲數值，不代表真實距離；起跳只需輕輕向上跳。</p>
        <div className="long-jump-result-actions">
          <button type="button" onClick={onReplay}>再玩一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
