import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import {
  PoseGameplayInputRuntime,
  type PoseGameplayInputSnapshot,
} from '../../motion/runtime/PoseGameplayInputRuntime'
import { RhythmCanvas } from './RhythmCanvas'
import { RhythmResult } from './RhythmResult'
import { RhythmSession } from './RhythmSession'
import { RhythmTopbar } from './RhythmTopbar'
import './RhythmGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const RHYTHM_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['UPPER_BODY']),
  }]),
  actions: Object.freeze([
    'MOVE_LEFT',
    'MOVE_RIGHT',
    'LEAN_LEFT',
    'LEAN_RIGHT',
    'REACH_LEFT',
    'REACH_RIGHT',
  ] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

// oxlint-disable-next-line react/only-export-components
export async function startRhythmCamera(
  runtime: Pick<PoseGameplayInputRuntime, 'start'> | null,
): Promise<void> {
  await runtime?.start(RHYTHM_POSE_INPUT_REQUEST)
}

function RhythmPoseSetupGuide() {
  return (
    <div className="rhythm-pose-setup-guide" aria-label="上半身入鏡與節奏動作提示">
      <strong>上半身完整入鏡</strong>
      <span>頭部、肩膀、手臂、手腕、軀幹與髖部都要看得見</span>
      <div>
        <span>← 左移／左傾</span>
        <span>右移／右傾 →</span>
        <span>↙ 左手伸出</span>
        <span>右手伸出 ↘</span>
      </div>
    </div>
  )
}

const INITIAL_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({
  status: 'CAMERA_NOT_STARTED',
  error: null,
})

export default function RhythmPoseGameScreen({ onExit }: { readonly onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider())
  const [session] = useState(() => new RhythmSession(provider))
  const [poseSnapshot, setPoseSnapshot] = useState(INITIAL_SNAPSHOT)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    const runtime = new PoseGameplayInputRuntime({
      getVideo: () => videoRef.current,
      provider,
      framingRequirement: 'UPPER_BODY',
    })
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
        hardFailure:
          snapshot.status === 'ERROR' || snapshot.status === 'CAMERA_NOT_STARTED',
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
      void Promise.all([session.stop(), runtime.dispose()])
    }
  }, [provider, session])

  const startCamera = useCallback(() => {
    void startRhythmCamera(runtimeRef.current).catch(() => undefined)
  }, [])
  const gamePhase = state.phase === 'FINISHED' ? 'RESULT' : state.phase
  const presentation = resolveCameraPresentation(
    poseSnapshot,
    gamePhase,
    'UPPER_BODY',
  )

  return (
    <main
      className="rhythm-shell"
      data-input-mode="pose"
      data-presentation-mode={presentation.mode}
    >
      <RhythmTopbar state={state} onExit={onExit} />
      <CameraPresentationStage
        className="rhythm-stage"
        presentation={presentation}
        videoRef={videoRef}
        onStartCamera={() => void startCamera()}
        framingInstruction="請讓頭部、肩膀、手臂、手腕、軀幹與髖部清楚入鏡"
        foreground={state.phase === 'FINISHED'
          ? <RhythmResult state={state} onReplay={() => session.replay()} onExit={onExit} />
          : poseSnapshot.status === 'CAMERA_NOT_STARTED'
            ? <RhythmPoseSetupGuide />
            : null}
      >
        <RhythmCanvas session={session} />
      </CameraPresentationStage>
    </main>
  )
}
