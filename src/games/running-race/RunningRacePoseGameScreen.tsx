import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { LocomotionSnapshot, LocomotionSnapshotSource } from '../../motion/contracts/locomotion'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import {
  PoseGameplayInputRuntime,
  type PoseGameplayInputSnapshot,
} from '../../motion/runtime/PoseGameplayInputRuntime'
import { RunningRaceCanvas } from './RunningRaceCanvas'
import { RunningRaceResult } from './RunningRaceResult'
import { RunningRaceSession } from './RunningRaceSession'
import { RunningRaceTopbar } from './RunningRaceTopbar'
import './RunningRaceGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const RUNNING_RACE_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['STANDARD']),
  }]),
  actions: Object.freeze([] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

// oxlint-disable-next-line react/only-export-components
export async function startRunningRaceCamera(
  runtime: Pick<PoseGameplayInputRuntime, 'start'> | null,
): Promise<void> {
  await runtime?.start(RUNNING_RACE_POSE_INPUT_REQUEST)
}

const EMPTY_LOCOMOTION_SNAPSHOT: LocomotionSnapshot = Object.freeze({
  timestampMs: 0,
  sequence: 0,
  availability: 'UNAVAILABLE',
  cadenceSpm: 0,
  intensity: 0,
  latestStep: null,
})

export default function RunningRacePoseGameScreen({ onExit }: { readonly onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider({ lowerBodyReadiness: 'KNEES' }))
  const [locomotionSource] = useState<LocomotionSnapshotSource>(() => ({
    getSnapshot: () => runtimeRef.current?.getLocomotionSnapshot() ?? EMPTY_LOCOMOTION_SNAPSHOT,
    subscribe: () => () => undefined,
  }))
  const [session] = useState(() => new RunningRaceSession(locomotionSource))
  const [poseSnapshot, setPoseSnapshot] = useState<PoseGameplayInputSnapshot>({
    status: 'CAMERA_NOT_STARTED',
    error: null,
  })
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
      void Promise.all([session.stop(), runtime.dispose()])
    }
  }, [provider, session])

  const startCamera = useCallback(() => {
    void startRunningRaceCamera(runtimeRef.current).catch(() => undefined)
  }, [])
  const gamePhase = state.phase === 'FINISHED' ? 'RESULT' : state.phase
  const presentation = resolveCameraPresentation(poseSnapshot, gamePhase, 'FULL_BODY')
  const showFramingNote = poseSnapshot.status !== 'READY' && state.phase !== 'FINISHED'

  return (
    <main
      className="running-race-shell"
      data-input-mode="pose"
      data-presentation-mode={presentation.mode}
    >
      <RunningRaceTopbar state={state} onExit={onExit} />
      <CameraPresentationStage
        className="running-race-stage"
        presentation={presentation}
        videoRef={videoRef}
        onStartCamera={() => void startCamera()}
        framingInstruction="請讓頭、肩、髖部與雙膝清楚入鏡，腳踝可暫時離開畫面"
        foreground={state.phase === 'FINISHED'
          ? <RunningRaceResult state={state} onReplay={() => session.replay()} onExit={onExit} />
          : null}
      >
        <RunningRaceCanvas session={session} />
      </CameraPresentationStage>
      {showFramingNote ? (
        <p className="running-race-production-framing-note" role="note">
          頭、肩、髖部與雙膝清楚入鏡
          <span>腳踝可暫時離開畫面</span>
        </p>
      ) : null}
    </main>
  )
}
