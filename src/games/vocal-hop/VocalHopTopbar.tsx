import type { VocalHopState } from './VocalHopCore'

export function VocalHopTopbar({ state, onExit, developer = false }: { readonly state: VocalHopState; readonly onExit: () => void; readonly developer?: boolean }) {
  return (
    <header className="vocal-hop-topbar">
      <button className="vocal-hop-home" type="button" onClick={onExit}>← 回首頁</button>
      <div className="vocal-hop-title">
        <small>{developer ? 'DEVELOPER TEST MODE' : 'VOICE INPUT · NO CAMERA'}</small>
        <h1>聲控跳跳樂 <span>Vocal Hop</span></h1>
      </div>
      <div className="vocal-hop-hud">
        <span>分數 <strong>{state.score}</strong></span>
        <span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1_000)}</strong></span>
        <span>連續 <strong>{state.currentStreak}</strong></span>
      </div>
    </header>
  )
}
