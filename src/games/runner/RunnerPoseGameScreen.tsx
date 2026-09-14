import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import {
  PoseGameplayInputRuntime,
  type PoseGameplayInputSnapshot,
} from '../../motion/runtime/PoseGameplayInputRuntime'
import { RunnerCanvas } from './RunnerCanvas'
import { RunnerResult } from './RunnerResult'
import { RunnerSession } from './RunnerSession'
import { RunnerTopbar } from './RunnerTopbar'
import './RunnerGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const RUNNER_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['STANDARD']),
  }]),
  actions: Object.freeze(['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'SQUAT'] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

// oxlint-disable-next-line react/only-export-components
export async function startRunnerCamera(
  runtime: Pick<PoseGameplayInputRuntime, 'start'> | null,
): Promise<void> {
  await runtime?.start(RUNNER_POSE_INPUT_REQUEST)
}

const INITIAL_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({
  status: 'CAMERA_NOT_STARTED',
  error: null,
})

export default function RunnerPoseGameScreen({ onExit }: { readonly onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider())
  const [session] = useState(() => new RunnerSession(provider))
  const [poseSnapshot, setPoseSnapshot] = useState(INITIAL_SNAPSHOT)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    const runtime = new PoseGameplayInputRuntime({
      getVideo: () => videoRef.current,
      provider,
      framingRequirement: 'FULL_BODY',
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
    void startRunnerCamera(runtimeRef.current).catch(() => undefined)
  }, [])
  const gamePhase = state.phase === 'FINISHED' ? 'RESULT' : state.phase
  const presentation = resolveCameraPresentation(
    poseSnapshot,
    gamePhase,
    'FULL_BODY',
  )

  return (
    <main
      className="runner-shell"
      data-input-mode="pose"
      data-presentation-mode={presentation.mode}
    >
      <RunnerTopbar state={state} onExit={onExit} />
      <CameraPresentationStage
        className="runner-stage"
        presentation={presentation}
        videoRef={videoRef}
        onStartCamera={() => void startCamera()}
        framingInstruction="請讓頭頂、肩膀、髖部、膝蓋與雙腳踝清楚入鏡"
        foreground={state.phase === 'FINISHED'
          ? <RunnerResult state={state} onReplay={() => session.replay()} onExit={onExit} />
          : null}
      >
        <RunnerCanvas session={session} />
      </CameraPresentationStage>
    </main>
  )
}
