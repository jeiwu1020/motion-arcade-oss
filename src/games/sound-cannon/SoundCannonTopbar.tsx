import type { SoundCannonState } from './SoundCannonCore'

export function SoundCannonTopbar({ state, onExit, developer = false }: { readonly state: SoundCannonState; readonly onExit: () => void; readonly developer?: boolean }) {
  return <header className="sound-cannon-topbar"><button type="button" onClick={onExit}>← 回首頁</button><div><small>{developer ? 'DEVELOPER TEST MODE' : 'VOICE INPUT · NO CAMERA'}</small><h1>音波砲 <span>Sound Cannon</span></h1></div><div className="sound-cannon-hud"><span>分數 <strong>{state.score}</strong></span><span>時間 <strong>{Math.ceil(state.roundRemainingMs / 1000)}</strong></span><span>連續 <strong>{state.currentStreak}</strong></span></div></header>
}
