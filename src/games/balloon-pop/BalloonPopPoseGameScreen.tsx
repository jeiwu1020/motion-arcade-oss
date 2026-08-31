import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

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

function lifecycleLabel(
  pose: PoseGameplayInputSnapshot,
  phase: ReturnType<BalloonPopSession['getState']>['phase'],
): string {
  if (phase === 'FINISHED') return 'RESULT'
  if (pose.status === 'CAMERA_NOT_STARTED') return '相機尚未啟動'
  if (pose.status === 'PERMISSION_STARTING') return '正在啟動相機'
  if (pose.status === 'BASELINING') return '建立動作基準中'
  if (pose.status === 'TRACKING_LOST') return '追蹤暫停'
  if (pose.status === 'ERROR') return '需要處理'
  return phase === 'PLAYING' ? 'PLAYING' : 'READY'
}

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
  const showPreview =
    poseSnapshot.status !== 'CAMERA_NOT_STARTED' &&
    poseSnapshot.status !== 'ERROR'

  return (
    <main className="balloon-pop-shell" data-input-mode="pose">
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
            {lifecycleLabel(poseSnapshot, state.phase)}
          </span>
          <span>分數 <strong>{state.score}</strong></span>
          <span>時間 <strong>{secondsRemaining}</strong></span>
        </div>
      </header>

      <section className="balloon-pop-stage">
        <BalloonPopCanvas session={session} />
        <video
          ref={videoRef}
          className="balloon-pop-camera-preview"
          data-visible={showPreview}
          aria-label="鏡像相機預覽"
          autoPlay
          muted
          playsInline
        />

        <PoseLifecycleOverlay
          pose={poseSnapshot}
          phase={state.phase}
          onStartCamera={() => void startCamera()}
        />

        {state.phase === 'FINISHED' ? (
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
      </section>
    </main>
  )
}

function PoseLifecycleOverlay({
  pose,
  phase,
  onStartCamera,
}: {
  readonly pose: PoseGameplayInputSnapshot
  readonly phase: ReturnType<BalloonPopSession['getState']>['phase']
  readonly onStartCamera: () => void
}) {
  if (phase === 'FINISHED' || pose.status === 'READY') return null

  if (pose.status === 'CAMERA_NOT_STARTED') {
    return (
      <div className="balloon-pop-pose-overlay" role="status">
        <div>
          <p>REAL POSE INPUT</p>
          <h2>準備好後啟動相機</h2>
          <span>相機只會在你按下按鈕後啟動。</span>
          <button type="button" onClick={onStartCamera}>啟動相機</button>
        </div>
      </div>
    )
  }

  if (pose.status === 'ERROR') {
    return (
      <div className="balloon-pop-pose-overlay" role="alert">
        <div>
          <p>{pose.error?.code ?? 'ERROR'}</p>
          <h2>無法使用姿勢辨識</h2>
          <span>{pose.error?.message}</span>
          <button type="button" onClick={onStartCamera}>重新啟動相機</button>
        </div>
      </div>
    )
  }

  if (pose.status === 'TRACKING_LOST') {
    return (
      <div className="balloon-pop-pose-overlay" role="status">
        <div>
          <p>GAME PAUSED</p>
          <h2>請回到畫面中</h2>
          <span>確認全身可見；追蹤恢復後會自動繼續。</span>
        </div>
      </div>
    )
  }

  return (
    <div className="balloon-pop-pose-overlay" role="status">
      <div>
        <p>
          {pose.status === 'PERMISSION_STARTING'
            ? 'STARTING CAMERA'
            : 'BASELINING'}
        </p>
        <h2>
          {pose.status === 'PERMISSION_STARTING'
            ? '正在啟動相機…'
            : '請站在畫面中央'}
        </h2>
        <span>
          {pose.status === 'PERMISSION_STARTING'
            ? '請在瀏覽器提示中允許相機權限。'
            : '讓肩膀、髖部、膝蓋與腳踝保持清楚可見。'}
        </span>
      </div>
    </div>
  )
}
