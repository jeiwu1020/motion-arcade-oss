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
import { LongJumpCanvas } from './LongJumpCanvas'
import { LongJumpResult } from './LongJumpResult'
import { LongJumpSession } from './LongJumpSession'
import { LongJumpTopbar } from './LongJumpTopbar'
import './LongJumpGameScreen.css'

// oxlint-disable-next-line react/only-export-components
export const LONG_JUMP_POSE_INPUT_REQUEST = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['STANDARD']),
  }]),
  actions: Object.freeze(['JUMP'] as const),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

// oxlint-disable-next-line react/only-export-components
export async function startLongJumpCamera(
  runtime: Pick<PoseGameplayInputRuntime, 'start'> | null,
): Promise<void> {
  await runtime?.start(LONG_JUMP_POSE_INPUT_REQUEST)
}

const EMPTY_LOCOMOTION_SNAPSHOT: LocomotionSnapshot = Object.freeze({
  timestampMs: 0,
  sequence: 0,
  availability: 'UNAVAILABLE',
  cadenceSpm: 0,
  intensity: 0,
  latestStep: null,
})

function LongJumpPoseSetupGuide() {
  return (
    <div className="long-jump-pose-setup-guide" aria-label="飛躍挑戰全身入鏡提示">
      <strong>頭、肩、髖部、膝蓋與雙腳踝完整入鏡</strong>
      <span>原地抬膝蓄力，看到起跳提示後輕輕向上跳即可。不要往前跳。</span>
    </div>
  )
}

export default function LongJumpPoseGameScreen({ onExit }: { readonly onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider())
  const [locomotionSource] = useState<LocomotionSnapshotSource>(() => ({
    getSnapshot: () => runtimeRef.current?.getLocomotionSnapshot() ?? EMPTY_LOCOMOTION_SNAPSHOT,
    subscribe: () => () => undefined,
  }))
  const [session] = useState(() => new LongJumpSession(locomotionSource, provider))
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
  }, [locomotionSource, provider, session])

  const startCamera = useCallback(() => {
    void startLongJumpCamera(runtimeRef.current).catch(() => undefined)
  }, [])
  const gamePhase = state.phase === 'FINISHED' ? 'RESULT' : 'PLAYING'
  const presentation = resolveCameraPresentation(poseSnapshot, gamePhase, 'FULL_BODY')

  return (
    <main className="long-jump-shell" data-input-mode="pose" data-presentation-mode={presentation.mode}>
      <LongJumpTopbar state={state} onExit={onExit} />
      <CameraPresentationStage
        className="long-jump-stage"
        presentation={presentation}
        videoRef={videoRef}
        onStartCamera={() => void startCamera()}
        framingInstruction="請讓頭、肩、髖部、膝蓋與雙腳踝清楚入鏡"
        foreground={state.phase === 'FINISHED'
          ? <LongJumpResult state={state} onReplay={() => session.replay()} onExit={onExit} />
          : poseSnapshot.status === 'CAMERA_NOT_STARTED' ? <LongJumpPoseSetupGuide /> : null}
      >
        <LongJumpCanvas session={session} />
      </CameraPresentationStage>
    </main>
  )
}
