import type { HighJumpState } from './HighJumpCore'

export function HighJumpResult({
  state,
  onReplay,
  onExit,
}: {
  readonly state: HighJumpState
  readonly onReplay: () => void
  readonly onExit: () => void
}) {
  return (
    <div className="high-jump-result" role="dialog" aria-modal="true">
      <div className="high-jump-result-card">
        <p>HIGH JUMP · ARCADE MATCH</p>
        <h2>五關挑戰完成</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>成功越過</dt><dd>{state.barsCleared} / 5</dd></div>
          <div><dt>最佳關卡</dt><dd>{state.bestClearedLevel || '—'}</dd></div>
          <div><dt>PERFECT</dt><dd>{state.perfectCount}</dd></div>
          <div><dt>GREAT</dt><dd>{state.greatCount}</dd></div>
          <div><dt>GOOD</dt><dd>{state.goodCount}</dd></div>
          <div><dt>未起跳</dt><dd>{state.noJumpCount}</dd></div>
        </dl>
        <p className="high-jump-result-note">每次有效跳躍在遊戲中視為相同；分數只看起跳時機，不代表真實跳躍高度。</p>
        <div className="high-jump-result-actions">
          <button type="button" onClick={onReplay}>再跳一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
