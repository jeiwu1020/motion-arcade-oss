import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { CameraPresentationStage } from '../../components/camera-presentation/CameraPresentationStage'
import { resolveCameraPresentation } from '../../components/camera-presentation/cameraPresentationModel'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import {
  PoseGameplayInputRuntime,
  type PoseGameplayInputSnapshot,
} from '../../motion/runtime/PoseGameplayInputRuntime'
import { BalloonPopCanvas } from './BalloonPopCanvas'
import {
  BALLOON_POP_POSE_INPUT_REQUEST,
  BalloonPopSession,
} from './BalloonPopSession'
import './BalloonPopGameScreen.css'

interface BalloonPopPoseGameScreenProps {
  readonly onExit: () => void
}

const INITIAL_POSE_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({
  status: 'CAMERA_NOT_STARTED',
  error: null,
})

export default function BalloonPopPoseGameScreen({
  onExit,
}: BalloonPopPoseGameScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const runtimeRef = useRef<PoseGameplayInputRuntime | null>(null)
  const [provider] = useState(() => new PoseMotionInputProvider())
  const [session] = useState(
    () =>
      new BalloonPopSession(provider, {
        managesProviderLifecycle: false,
      }),
  )
  const [poseSnapshot, setPoseSnapshot] = useState(INITIAL_POSE_SNAPSHOT)
  const state = useSyncExternalStore(
    session.subscribe,
    session.getState,
    session.getState,
  )

  useEffect(() => {
    const runtime = new PoseGameplayInputRuntime({
      getVideo: () => videoRef.current,
      provider,
    })
    runtimeRef.current = runtime
    setPoseSnapshot(runtime.getSnapshot())
    const unsubscribe = runtime.subscribe(() => {
      setPoseSnapshot(runtime.getSnapshot())
    })
    let cancelled = false
    let animationFrame = 0
    let previousTime = performance.now()

    const frame = (time: number) => {
      void runtime.update(time)
      session.tick(
        time - previousTime,
        runtime.getSnapshot().status === 'READY',
      )
      previousTime = time
      animationFrame = requestAnimationFrame(frame)
    }

    void session.start().then(() => {
      if (cancelled) return
      previousTime = performance.now()
      animationFrame = requestAnimationFrame(frame)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      unsubscribe()
      if (runtimeRef.current === runtime) runtimeRef.current = null
      void Promise.all([session.stop(), runtime.dispose()])
    }
  }, [provider, session])

  const startCamera = useCallback(async () => {
    try {
      await runtimeRef.current?.start(BALLOON_POP_POSE_INPUT_REQUEST)
    } catch {
      // The runtime publishes a readable, recoverable ERROR snapshot.
    }
  }, [])

  const secondsRemaining = Math.ceil(state.roundRemainingMs / 1_000)
  const presentation = resolveCameraPresentation(
    poseSnapshot,
    state.phase === 'FINISHED' ? 'RESULT' : state.phase,
  )

  return (
    <main
      className="balloon-pop-shell"
      data-input-mode="pose"
      data-presentation-mode={presentation.mode}
    >
      <header className="balloon-pop-topbar">
        <button className="balloon-pop-home" type="button" onClick={onExit}>
          ← 回首頁
        </button>
        <div>
          <span>小遊戲 · REAL POSE</span>
          <h1>氣球拍拍樂</h1>
        </div>
        <div className="balloon-pop-hud" aria-label="遊戲狀態">
          <span className="balloon-pop-lifecycle">
            {presentation.statusLabel}
          </span>
          <span>分數 <strong>{state.score}</strong></span>
          <span>時間 <strong>{secondsRemaining}</strong></span>
        </div>
      </header>

      <CameraPresentationStage
        className="balloon-pop-stage"
        presentation={presentation}
        videoRef={videoRef}
        onStartCamera={() => void startCamera()}
        foreground={state.phase === 'FINISHED' ? (
          <div className="balloon-pop-result" role="dialog" aria-modal="true">
            <div className="balloon-pop-result-card">
              <p>ROUND COMPLETE</p>
              <h2>完成！</h2>
              <strong className="balloon-pop-final-score">{state.score} 分</strong>
              <dl>
                <div><dt>命中</dt><dd>{state.hits}</dd></div>
                <div><dt>錯過</dt><dd>{state.misses}</dd></div>
              </dl>
              <div className="balloon-pop-result-actions">
                <button type="button" onClick={() => session.replay()}>
                  再玩一次
                </button>
                <button type="button" onClick={onExit}>回到首頁</button>
              </div>
            </div>
          </div>
        ) : null}
      >
        <BalloonPopCanvas session={session} presentation="CAMERA_AR" />
      </CameraPresentationStage>
    </main>
  )
}
