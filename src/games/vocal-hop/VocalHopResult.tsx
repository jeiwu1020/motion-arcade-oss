import type { VocalHopState } from './VocalHopCore'

export function VocalHopResult({ state, onReplay, onExit }: { readonly state: VocalHopState; readonly onReplay: () => void; readonly onExit: () => void }) {
  return (
    <div className="vocal-hop-result" role="dialog" aria-modal="true">
      <div className="vocal-hop-result-card">
        <p>VOCAL HOP · 60 秒完成</p>
        <h2>跳跳路線完成！</h2>
        <strong>{state.score} 分</strong>
        <dl>
          <div><dt>成功跳躍</dt><dd>{state.requiredClears}</dd></div>
          <div><dt>碰撞次數</dt><dd>{state.stumbles}</dd></div>
          <div><dt>星星數</dt><dd>{state.starsCollected}</dd></div>
          <div><dt>最佳連續通過</dt><dd>{state.bestStreak}</dd></div>
        </dl>
        <p className="vocal-hop-result-note">遊戲發聲時間 {state.voiceActiveTimeGameValue.toFixed(1)} 秒</p>
        <div className="vocal-hop-result-actions">
          <button type="button" onClick={onReplay}>再玩一次</button>
          <button type="button" onClick={onExit}>回首頁</button>
        </div>
      </div>
    </div>
  )
}
