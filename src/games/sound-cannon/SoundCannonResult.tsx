import type { SoundCannonState } from './SoundCannonCore'

export function SoundCannonResult({ state, onReplay, onExit }: { readonly state: SoundCannonState; readonly onReplay: () => void; readonly onExit: () => void }) {
  return <div className="sound-cannon-result" role="dialog" aria-modal="true"><div><p>SOUND CANNON · 60 秒完成</p><h2>音波砲戰績</h2><strong>{state.score} 分</strong><dl><div><dt>命中數</dt><dd>{state.hits}</dd></div><div><dt>MISS</dt><dd>{state.misses}</dd></div><div><dt>浪費砲擊</dt><dd>{state.wastedShots}</dd></div><div><dt>FULL BLAST</dt><dd>{state.fullBlastCount}</dd></div><div><dt>最佳連續命中</dt><dd>{state.bestStreak}</dd></div><div><dt>PERFECT</dt><dd>{state.perfectCount}</dd></div></dl><div className="sound-cannon-result-actions"><button type="button" onClick={onReplay}>再玩一次</button><button type="button" onClick={onExit}>回首頁</button></div></div></div>
}
