import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import { PoseGameplayInputRuntime, type PoseGameplayInputSnapshot } from '../../motion/runtime/PoseGameplayInputRuntime'
import { HighJumpCanvas } from './HighJumpCanvas'
import { HighJumpResult } from './HighJumpResult'
import { HighJumpSession } from './HighJumpSession'
import { HighJumpTopbar } from './HighJumpTopbar'
import './HighJumpGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const HIGH_JUMP_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }]),
  actions: Object.freeze(['JUMP'] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

// oxlint-disable-next-line react/only-export-components
export async function startHighJumpCamera(
  runtime: Pick<PoseGameplayInputRuntime, 'start'> | null,
): Promise<void> {
  await runtime?.start(HIGH_JUMP_POSE_INPUT_REQUEST)
}

const INITIAL_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({ status: 'CAMERA_NOT_STARTED', error: null })

function HighJumpPoseSetupGuide() {
  return (
    <div className="high-jump-pose-setup-guide" aria-label="跳高全身入鏡提示">
      <strong>全身與腳踝完整入鏡</strong>
      <span>頭、肩、髖部、膝蓋與雙腳踝都要清楚看見</span>
      <div><span>輕輕向上跳即可</span><span>重點是抓準起跳時機</span></div>
    </div>
  )
}

export default function HighJumpPoseGameScreen({ onExit }: { readonly onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider())
  const [session] = useState(() => new HighJumpSession(provider))
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
    void startHighJumpCamera(runtimeRef.current).catch(() => undefined)
  }, [])
  const gamePhase = state.phase === 'FINISHED' ? 'RESULT' : 'PLAYING'
  const presentation = resolveCameraPresentation(poseSnapshot, gamePhase, 'FULL_BODY')

  return (
    <main className="high-jump-shell" data-input-mode="pose" data-presentation-mode={presentation.mode}>
      <HighJumpTopbar state={state} onExit={onExit} />
      <CameraPresentationStage
        className="high-jump-stage"
        presentation={presentation}
        videoRef={videoRef}
        onStartCamera={() => void startCamera()}
        framingInstruction="請讓頭、肩、髖部、膝蓋與雙腳踝清楚入鏡"
        foreground={state.phase === 'FINISHED'
          ? <HighJumpResult state={state} onReplay={() => session.replay()} onExit={onExit} />
          : poseSnapshot.status === 'CAMERA_NOT_STARTED' ? <HighJumpPoseSetupGuide /> : null}
      >
        <HighJumpCanvas session={session} />
      </CameraPresentationStage>
    </main>
  )
}
