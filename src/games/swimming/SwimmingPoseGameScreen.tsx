import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { SportsMotionSnapshot, SportsMotionSnapshotSource } from '../../motion/contracts/sportsMotion'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import { PoseGameplayInputRuntime, type PoseGameplayInputSnapshot } from '../../motion/runtime/PoseGameplayInputRuntime'
import { SwimmingCanvas } from './SwimmingCanvas'
import { SwimmingResult } from './SwimmingResult'
import { SwimmingSession } from './SwimmingSession'
import { SwimmingTopbar } from './SwimmingTopbar'
import './SwimmingGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const SWIMMING_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['UPPER_BODY']) }]),
  actions: Object.freeze([] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

// oxlint-disable-next-line react/only-export-components
export async function startSwimmingCamera(runtime: Pick<PoseGameplayInputRuntime, 'start'> | null): Promise<void> {
  await runtime?.start(SWIMMING_POSE_INPUT_REQUEST)
}

const EMPTY_HAND = Object.freeze({ availability: 'UNAVAILABLE' as const, timestampMs: 0, sequence: 0 })
const EMPTY_SPORTS_SNAPSHOT: SportsMotionSnapshot = Object.freeze({
  timestampMs: 0, sequence: 0, leftHand: EMPTY_HAND, rightHand: EMPTY_HAND, leftSwing: null, rightSwing: null,
})
const INITIAL_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({ status: 'CAMERA_NOT_STARTED', error: null })

function SwimmingPoseSetupGuide() {
  return (
    <div className="swimming-pose-setup-guide" aria-label="上半身入鏡與交替划水提示">
      <strong>站立上半身完整入鏡</strong>
      <span>頭部、肩膀、手臂、手腕、軀幹與髖部都要看得見</span>
      <div><span>左右手交替做寬廣划水動作</span><span>不需走動，也不是真實游泳訓練</span></div>
    </div>
  )
}

export default function SwimmingPoseGameScreen({ onExit }: { readonly onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider())
  const [sportsSource] = useState<SportsMotionSnapshotSource>(() => ({
    getSnapshot: () => runtimeRef.current?.getSportsMotionSnapshot() ?? EMPTY_SPORTS_SNAPSHOT,
    subscribe: () => () => undefined,
  }))
  const [session] = useState(() => new SwimmingSession(sportsSource))
  const [poseSnapshot, setPoseSnapshot] = useState(INITIAL_SNAPSHOT)
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    const runtime = new PoseGameplayInputRuntime({ getVideo: () => videoRef.current, provider, framingRequirement: 'UPPER_BODY' })
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

  const startCamera = useCallback(() => { void startSwimmingCamera(runtimeRef.current).catch(() => undefined) }, [])
  const gamePhase = state.phase === 'FINISHED' ? 'RESULT' : state.phase
  const presentation = resolveCameraPresentation(poseSnapshot, gamePhase, 'UPPER_BODY')

  return (
    <main className="swimming-shell" data-input-mode="pose" data-presentation-mode={presentation.mode}>
      <SwimmingTopbar state={state} onExit={onExit} />
      <CameraPresentationStage
        className="swimming-stage"
        presentation={presentation}
        videoRef={videoRef}
        onStartCamera={() => void startCamera()}
        framingInstruction="請讓頭部、肩膀、手臂、手腕、軀幹與髖部清楚入鏡"
        foreground={state.phase === 'FINISHED'
          ? <SwimmingResult state={state} onReplay={() => session.replay()} onExit={onExit} />
          : poseSnapshot.status === 'CAMERA_NOT_STARTED' ? <SwimmingPoseSetupGuide /> : null}
      >
        <SwimmingCanvas session={session} />
      </CameraPresentationStage>
    </main>
  )
}
