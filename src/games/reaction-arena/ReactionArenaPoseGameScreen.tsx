import { useCallback, useEffect, useState, useRef } from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import { PoseGameplayInputRuntime, type PoseGameplayInputSnapshot } from '../../motion/runtime/PoseGameplayInputRuntime'
import type { PoseTrackingSnapshot } from '../../motion/contracts/poseTracking'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { ReactionArenaAudio } from './ReactionArenaAudio'
import { ReactionArenaCanvas } from './ReactionArenaCanvas'
import { ReactionArenaPracticeSession } from './ReactionArenaPracticeSession'
import { ReactionArenaSession } from './ReactionArenaSession'
import './ReactionArenaGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const REACTION_ARENA_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['LOW_MOTION']) }]),
  actions: Object.freeze(['MOVE_LEFT', 'MOVE_RIGHT', 'LEAN_LEFT', 'LEAN_RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT'] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

const INITIAL_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({ status: 'CAMERA_NOT_STARTED', error: null })

export interface ReactionArenaPoseGameScreenProps { readonly onExit: () => void }

type ReactionArenaMode = 'GAME' | 'PRACTICE'

/** The camera path uses the shared FULL_BODY runtime and normalized Motion Actions only. */
// oxlint-disable-next-line react/only-export-components
export async function startReactionArenaCamera(
  audio: Pick<ReactionArenaAudio, 'unlock'>,
  runtime: Pick<PoseGameplayInputRuntime, 'start'> | null,
): Promise<void> {
  try { void audio.unlock().catch(() => undefined) } catch { /* optional */ }
  await runtime?.start(REACTION_ARENA_POSE_INPUT_REQUEST)
}

export default function ReactionArenaPoseGameScreen({ onExit }: ReactionArenaPoseGameScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const activeSessionRef = useRef<ReactionArenaSession | ReactionArenaPracticeSession | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider({ lowerBodyReadiness: 'KNEES' }))
  const [gameSession] = useState(() => new ReactionArenaSession(provider))
  const [practiceSession] = useState(() => new ReactionArenaPracticeSession(provider))
  const [audio] = useState(() => new ReactionArenaAudio())
  const [mode, setMode] = useState<ReactionArenaMode>('GAME')
  const activeSession = mode === 'PRACTICE' ? practiceSession : gameSession
  const previousSessionRef = useRef(activeSession)
  const initialSessionRef = useRef(activeSession)
  const [poseSnapshot, setPoseSnapshot] = useState(INITIAL_SNAPSHOT)
  const [poseTrackingSnapshot, setPoseTrackingSnapshot] = useState<PoseTrackingSnapshot | null>(null)
  const [, setSessionRevision] = useState(0)

  useEffect(() => {
    activeSessionRef.current = activeSession
    return () => {
      if (activeSessionRef.current === activeSession) activeSessionRef.current = null
    }
  }, [activeSession])

  useEffect(() => activeSession.subscribe(() => setSessionRevision((revision) => revision + 1)), [activeSession])

  // Keep one camera/runtime lifecycle while swapping game-local sessions.
  useEffect(() => {
    const runtime = new PoseGameplayInputRuntime({ getVideo: () => videoRef.current, provider, framingRequirement: 'FULL_BODY' })
    runtimeRef.current = runtime
    setPoseSnapshot(runtime.getSnapshot())
    const updateRuntimePresentation = () => {
      setPoseSnapshot(runtime.getSnapshot())
      setPoseTrackingSnapshot(runtime.getPoseTrackingSnapshot())
    }
    const unsubscribe = runtime.subscribe(updateRuntimePresentation)
    let cancelled = false
    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      void runtime.update(time)
      const snapshot = runtime.getSnapshot()
      const trackingSnapshot = runtime.getPoseTrackingSnapshot()
      setPoseTrackingSnapshot((current) =>
        current?.sequence === trackingSnapshot.sequence ? current : trackingSnapshot,
      )
      activeSessionRef.current?.tick(time - previousTime, {
        setupReady: snapshot.status === 'READY',
        hardFailure: snapshot.status === 'ERROR' || snapshot.status === 'CAMERA_NOT_STARTED',
      })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    void initialSessionRef.current.start().then(() => {
      if (!cancelled) {
        previousTime = performance.now()
        animationFrame = requestAnimationFrame(frame)
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      unsubscribe()
      if (runtimeRef.current === runtime) runtimeRef.current = null
      setPoseTrackingSnapshot(null)
      void Promise.all([gameSession.stop(), practiceSession.stop(), runtime.dispose(), audio.dispose()])
    }
  }, [audio, gameSession, practiceSession, provider])

  useEffect(() => {
    const previousSession = previousSessionRef.current
    if (previousSession === activeSession) return
    previousSessionRef.current = activeSession
    void previousSession.stop().then(() => {
      activeSession.replay()
      return activeSession.start()
    })
  }, [activeSession])

  const startCamera = useCallback(() => {
    void startReactionArenaCamera(audio, runtimeRef.current).catch(() => undefined)
  }, [audio])
  const gameState = gameSession.getState()
  const practiceState = practiceSession.getState()
  const secondsRemaining = Math.ceil(gameState.roundRemainingMs / 1_000)
  const presentation = resolveCameraPresentation(
    poseSnapshot,
    mode === 'PRACTICE' ? 'PLAYING' : gameState.phase === 'FINISHED' ? 'RESULT' : gameState.phase,
    'FULL_BODY',
  )

  return <main className="reaction-arena-shell" data-input-mode="pose" data-presentation-mode={presentation.mode}>
    <header className="reaction-arena-topbar">
      <button className="reaction-arena-home" type="button" onClick={onExit}>← 回首頁</button>
      <div><small>小遊戲 · FULL BODY</small><h1>光速反應王</h1></div>
      <div className="reaction-arena-mode-picker" aria-label="遊戲模式">
        <button type="button" aria-pressed={mode === 'PRACTICE'} onClick={() => setMode('PRACTICE')}>動作測試</button>
        <button type="button" aria-pressed={mode === 'GAME'} onClick={() => setMode('GAME')}>開始遊戲</button>
      </div>
      {mode === 'PRACTICE'
        ? <div className="reaction-arena-hud"><span>動作測試</span></div>
        : <div className="reaction-arena-hud"><span>分數 <strong>{gameState.score}</strong></span><span>時間 <strong>{secondsRemaining}</strong></span>{gameState.combo >= 2 ? <span>Combo <strong>{gameState.combo}</strong></span> : null}</div>}
    </header>
    <CameraPresentationStage
      className="reaction-arena-stage"
      presentation={presentation}
      videoRef={videoRef}
      onStartCamera={() => void startCamera()}
      foreground={mode === 'PRACTICE' && practiceState.phase === 'COMPLETE'
        ? <ReactionArenaPracticeComplete onReplay={() => practiceSession.replay()} onStartGame={() => setMode('GAME')} onExit={onExit} />
        : mode === 'GAME' && gameState.phase === 'FINISHED'
          ? <ReactionArenaResult state={gameState} onReplay={() => gameSession.replay()} onExit={onExit} />
          : null}
      {...(poseTrackingSnapshot ? { poseTrackingSnapshot } : {})}
      showPoseTrackingOverlay={mode === 'PRACTICE' || presentation.mode !== 'PLAYING'}
      framingInstruction="請讓頭、肩、髖部與雙膝清楚入鏡，腳踝可暫時離開畫面"
    >
      <ReactionArenaCanvas session={activeSession} audio={audio} />
    </CameraPresentationStage>
  </main>
}

function ReactionArenaPracticeComplete({ onReplay, onStartGame, onExit }: { readonly onReplay: () => void; readonly onStartGame: () => void; readonly onExit: () => void }) {
  return <div className="reaction-arena-result reaction-arena-practice-complete" role="dialog" aria-modal="true"><div className="reaction-arena-result-card">
    <p>動作測試</p><h2>動作測試完成！</h2>
    <strong>All 5 actions have been recognized successfully.</strong>
    <div className="reaction-arena-result-actions"><button type="button" onClick={onReplay}>再測一次</button><button type="button" onClick={onStartGame}>開始 60 秒遊戲</button><button type="button" onClick={onExit}>回首頁</button></div>
  </div></div>
}

function ReactionArenaResult({ state, onReplay, onExit }: { readonly state: ReturnType<ReactionArenaSession['getState']>; readonly onReplay: () => void; readonly onExit: () => void }) {
  return <div className="reaction-arena-result" role="dialog" aria-modal="true"><div className="reaction-arena-result-card">
    <p>REACTION ARENA</p><h2>完成！</h2><strong>{state.score} 分</strong>
    <dl><div><dt>成功</dt><dd>{state.successfulCues}</dd></div><div><dt>錯過</dt><dd>{state.missedCues}</dd></div><div><dt>最佳 Combo</dt><dd>{state.bestCombo}</dd></div></dl>
    <dl><div><dt>PERFECT</dt><dd>{state.perfectCount}</dd></div><div><dt>GREAT</dt><dd>{state.greatCount}</dd></div><div><dt>GOOD</dt><dd>{state.goodCount}</dd></div></dl>
    <div className="reaction-arena-result-actions"><button type="button" onClick={onReplay}>再玩一次</button><button type="button" onClick={onExit}>回首頁</button></div>
  </div></div>
}
