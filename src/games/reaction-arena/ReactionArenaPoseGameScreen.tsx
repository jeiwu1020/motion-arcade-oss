import { useCallback, useEffect, useState, useSyncExternalStore, useRef } from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import { PoseGameplayInputRuntime, type PoseGameplayInputSnapshot } from '../../motion/runtime/PoseGameplayInputRuntime'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { ReactionArenaAudio } from './ReactionArenaAudio'
import { ReactionArenaCanvas } from './ReactionArenaCanvas'
import { ReactionArenaSession } from './ReactionArenaSession'
import './ReactionArenaGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const REACTION_ARENA_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }]),
  actions: Object.freeze(['MOVE_LEFT', 'MOVE_RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT'] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

const INITIAL_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({ status: 'CAMERA_NOT_STARTED', error: null })

export interface ReactionArenaPoseGameScreenProps { readonly onExit: () => void }

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
  const [provider] = useState(() => new PoseMotionInputProvider())
  const [session] = useState(() => new ReactionArenaSession(provider))
  const [audio] = useState(() => new ReactionArenaAudio())
  const [poseSnapshot, setPoseSnapshot] = useState(INITIAL_SNAPSHOT)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    const runtime = new PoseGameplayInputRuntime({ getVideo: () => videoRef.current, provider, framingRequirement: 'FULL_BODY' })
    runtimeRef.current = runtime
    setPoseSnapshot(runtime.getSnapshot())
    const unsubscribe = runtime.subscribe(() => setPoseSnapshot(runtime.getSnapshot()))
    let cancelled = false
    let animationFrame = 0
    let previousTime = performance.now()
    const frame = (time: number) => {
      void runtime.update(time)
      const snapshot = runtime.getSnapshot()
      session.tick(time - previousTime, {
        setupReady: snapshot.status === 'READY',
        hardFailure: snapshot.status === 'ERROR' || snapshot.status === 'CAMERA_NOT_STARTED',
      })
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }
    void session.start().then(() => {
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
      void Promise.all([session.stop(), runtime.dispose(), audio.dispose()])
    }
  }, [audio, provider, session])

  const startCamera = useCallback(() => {
    void startReactionArenaCamera(audio, runtimeRef.current).catch(() => undefined)
  }, [audio])
  const secondsRemaining = Math.ceil(state.roundRemainingMs / 1_000)
  const presentation = resolveCameraPresentation(poseSnapshot, state.phase === 'FINISHED' ? 'RESULT' : state.phase, 'FULL_BODY')

  return <main className="reaction-arena-shell" data-input-mode="pose" data-presentation-mode={presentation.mode}>
    <header className="reaction-arena-topbar">
      <button className="reaction-arena-home" type="button" onClick={onExit}>← 回首頁</button>
      <div><small>小遊戲 · FULL BODY</small><h1>光速反應王</h1></div>
      <div className="reaction-arena-hud"><span>分數 <strong>{state.score}</strong></span><span>時間 <strong>{secondsRemaining}</strong></span>{state.combo >= 2 ? <span>Combo <strong>{state.combo}</strong></span> : null}</div>
    </header>
    <CameraPresentationStage
      className="reaction-arena-stage"
      presentation={presentation}
      videoRef={videoRef}
      onStartCamera={() => void startCamera()}
      foreground={state.phase === 'FINISHED' ? <ReactionArenaResult state={state} onReplay={() => session.replay()} onExit={onExit} /> : null}
    >
      <ReactionArenaCanvas session={session} audio={audio} />
    </CameraPresentationStage>
  </main>
}

function ReactionArenaResult({ state, onReplay, onExit }: { readonly state: ReturnType<ReactionArenaSession['getState']>; readonly onReplay: () => void; readonly onExit: () => void }) {
  return <div className="reaction-arena-result" role="dialog" aria-modal="true"><div className="reaction-arena-result-card">
    <p>REACTION ARENA</p><h2>完成！</h2><strong>{state.score} 分</strong>
    <dl><div><dt>成功</dt><dd>{state.successfulCues}</dd></div><div><dt>錯過</dt><dd>{state.missedCues}</dd></div><div><dt>最佳 Combo</dt><dd>{state.bestCombo}</dd></div></dl>
    <dl><div><dt>PERFECT</dt><dd>{state.perfectCount}</dd></div><div><dt>GREAT</dt><dd>{state.greatCount}</dd></div><div><dt>GOOD</dt><dd>{state.goodCount}</dd></div></dl>
    <div className="reaction-arena-result-actions"><button type="button" onClick={onReplay}>再玩一次</button><button type="button" onClick={onExit}>回首頁</button></div>
  </div></div>
}
