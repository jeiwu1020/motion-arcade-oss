import { useCallback, useEffect, useRef, useState } from 'react'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import { PoseMotionInputProvider } from '../../motion/pose/PoseMotionInputProvider'
import type { PoseMotionAnalyzerSnapshot } from '../../motion/pose/poseMotionTypes'
import { CameraController, CameraControllerError } from '../../sensors/camera/CameraController'
import type { CameraSettings } from '../../sensors/camera/cameraTypes'
import { PoseSensorSession } from '../../sensors/pose/PoseSensorSession'
import { AdaptivePoseBackend } from '../../sensors/pose/inference/AdaptivePoseBackend'
import { PoseBackendError } from '../../sensors/pose/inference/PoseBackendError'
import type { PoseInferenceBackend } from '../../sensors/pose/inference/PoseInferenceBackend'
import { MIRRORED_PREVIEW_TRANSFORM, toRawOverlayPoint } from '../../sensors/pose/mirror'
import { InferenceScheduler } from '../../sensors/pose/scheduling/InferenceScheduler'
import {
  POSE_CONNECTIONS,
  type PoseInferenceResult,
  type PoseSensorFrame,
  type PoseSessionState,
} from '../../sensors/pose/poseTypes'
import './PoseSensorLab.css'

interface PoseSensorLabProps {
  readonly onExit: () => void
}

interface SensorTelemetry {
  readonly backendMode: 'WORKER' | 'MAIN_THREAD_FALLBACK' | 'NOT_STARTED'
  readonly fallbackReason: string | null
  readonly targetHz: number
  readonly actualHz: number
  readonly renderFps: number
  readonly meanInferenceMs: number
  readonly p95InferenceMs: number
  readonly droppedInferenceFrames: number
  readonly poseDetected: boolean
  readonly lastResultAt: number | null
  readonly lastResultAgeMs: number | null
  readonly modelStatus: 'NOT_LOADED' | 'LOADING' | 'READY' | 'ERROR' | 'CLOSED'
  readonly workerStatus: 'NOT_STARTED' | 'STARTING' | 'READY' | 'FALLBACK' | 'ERROR' | 'CLOSED'
}

const INITIAL_TELEMETRY: SensorTelemetry = {
  backendMode: 'NOT_STARTED',
  fallbackReason: null,
  targetHz: 20,
  actualHz: 0,
  renderFps: 0,
  meanInferenceMs: 0,
  p95InferenceMs: 0,
  droppedInferenceFrames: 0,
  poseDetected: false,
  lastResultAt: null,
  lastResultAgeMs: null,
  modelStatus: 'NOT_LOADED',
  workerStatus: 'NOT_STARTED',
}

const POSE_ANALYZER_REQUEST: MotionInputRequest = {
  players: [
    {
      playerId: 'pose-lab-player',
      abilityProfile: resolveAbilityProfile(['STANDARD']),
    },
  ],
  actions: [
    'MOVE_LEFT',
    'MOVE_RIGHT',
    'LEAN_LEFT',
    'LEAN_RIGHT',
    'REACH',
    'REACH_LEFT',
    'REACH_RIGHT',
    'SQUAT',
    'JUMP',
  ],
  sensors: { pose: true, hands: false, audio: false },
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
}

function errorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof CameraControllerError || error instanceof PoseBackendError) {
    return { code: error.code, message: error.message }
  }
  return { code: 'UNKNOWN', message: 'Sensor startup failed.' }
}

function drawPoseFrame(canvas: HTMLCanvasElement, frame: PoseSensorFrame): void {
  if (canvas.width !== frame.sourceWidth) canvas.width = frame.sourceWidth
  if (canvas.height !== frame.sourceHeight) canvas.height = frame.sourceHeight
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)

  const pose = frame.poses[0]
  if (!pose) return
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = Math.max(3, frame.sourceWidth / 260)
  context.strokeStyle = '#65f4cb'
  context.fillStyle = '#ffffff'
  context.shadowColor = 'rgb(0 0 0 / 55%)'
  context.shadowBlur = 5

  for (const [fromIndex, toIndex] of POSE_CONNECTIONS) {
    const from = pose.landmarks[fromIndex]
    const to = pose.landmarks[toIndex]
    if (!from || !to || (from.visibility ?? 1) < 0.35 || (to.visibility ?? 1) < 0.35) {
      continue
    }
    const fromPoint = toRawOverlayPoint(from, canvas.width, canvas.height)
    const toPoint = toRawOverlayPoint(to, canvas.width, canvas.height)
    context.beginPath()
    context.moveTo(fromPoint.x, fromPoint.y)
    context.lineTo(toPoint.x, toPoint.y)
    context.stroke()
  }

  for (const landmark of pose.landmarks) {
    if ((landmark.visibility ?? 1) < 0.35) continue
    const point = toRawOverlayPoint(landmark, canvas.width, canvas.height)
    context.beginPath()
    context.arc(point.x, point.y, Math.max(3, canvas.width / 300), 0, Math.PI * 2)
    context.fill()
  }
}

function formatNumber(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

export default function PoseSensorLab({ onExit }: PoseSensorLabProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sessionRef = useRef<PoseSensorSession | null>(null)
  const motionProviderRef = useRef<PoseMotionInputProvider | null>(null)
  const inferenceDurationsRef = useRef<number[]>([])
  const inferenceTimesRef = useRef<number[]>([])
  const [sessionState, setSessionState] = useState<PoseSessionState>('READY')
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null)
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY)
  const [analyzerDiagnostics, setAnalyzerDiagnostics] =
    useState<PoseMotionAnalyzerSnapshot | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  const handleSessionStateChange = useCallback((state: PoseSessionState) => {
    setSessionState(state)
    if (state === 'STOPPED' || state === 'SUSPENDED') {
      void motionProviderRef.current?.stop()
      setAnalyzerDiagnostics(
        motionProviderRef.current?.getDiagnostics() ?? null,
      )
    }
    if (state !== 'ERROR') return

    canvasRef.current
      ?.getContext('2d')
      ?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    inferenceDurationsRef.current = []
    inferenceTimesRef.current = []
    setCameraSettings(null)
    setTelemetry((current) => ({
      ...current,
      actualHz: 0,
      meanInferenceMs: 0,
      p95InferenceMs: 0,
      poseDetected: false,
      lastResultAt: null,
      lastResultAgeMs: null,
      modelStatus: 'ERROR',
      workerStatus: 'CLOSED',
    }))
    void motionProviderRef.current?.stop()
    setAnalyzerDiagnostics(
      motionProviderRef.current?.getDiagnostics() ?? null,
    )
  }, [])

  const handleInferenceResult = useCallback((result: PoseInferenceResult) => {
    if (canvasRef.current) drawPoseFrame(canvasRef.current, result.frame)
    motionProviderRef.current?.ingest(result.frame)
    setAnalyzerDiagnostics(
      motionProviderRef.current?.getDiagnostics() ?? null,
    )
    const now = performance.now()
    const durations = inferenceDurationsRef.current
    durations.push(result.inferenceDurationMs)
    if (durations.length > 120) durations.shift()
    const inferenceTimes = inferenceTimesRef.current
    inferenceTimes.push(now)
    while ((inferenceTimes[0] ?? now) < now - 1_000) inferenceTimes.shift()
    const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length

    setTelemetry((current) => ({
      ...current,
      actualHz: inferenceTimes.length,
      meanInferenceMs: mean,
      p95InferenceMs: percentile95(durations),
      droppedInferenceFrames:
        sessionRef.current?.getSchedulerStats()?.droppedInferenceFrames ?? 0,
      poseDetected: result.frame.poses.length > 0,
      lastResultAt: now,
      lastResultAgeMs: 0,
    }))
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const camera = new CameraController(video)
    const motionProvider = new PoseMotionInputProvider()
    motionProviderRef.current = motionProvider
    let activeSession: PoseSensorSession | null = null
    const onSessionStateChange = (state: PoseSessionState) => {
      if (activeSession && sessionRef.current === activeSession) {
        handleSessionStateChange(state)
      }
    }
    activeSession = new PoseSensorSession({
      camera,
      createBackend: () => new AdaptivePoseBackend(),
      createScheduler: (
        backend: PoseInferenceBackend,
        onFatalInferenceError,
      ) => {
        const targetHz = backend.mode === 'WORKER' ? 20 : 12
        return new InferenceScheduler<ImageBitmap, PoseInferenceResult>({
          targetHz,
          infer: (bitmap, timestampMs) =>
            backend.infer({
              bitmap,
              timestampMs,
              sourceWidth: video.videoWidth,
              sourceHeight: video.videoHeight,
            }),
          onResult: handleInferenceResult,
          onError: (inferenceError) => {
            setError(errorDetails(inferenceError))
            return onFatalInferenceError(inferenceError)
          },
        })
      },
      onStateChange: onSessionStateChange,
    })
    const session = activeSession
    sessionRef.current = session
    handleSessionStateChange(session.getState())

    let animationFrame = 0
    let renderWindowStartedAt = performance.now()
    let renderedFrames = 0
    const render = (now: number) => {
      renderedFrames += 1
      if (now - renderWindowStartedAt >= 1_000) {
        const elapsed = now - renderWindowStartedAt
        const renderFps = (renderedFrames * 1_000) / elapsed
        setTelemetry((current) => ({
          ...current,
          renderFps,
          lastResultAgeMs:
            current.lastResultAt === null ? null : now - current.lastResultAt,
        }))
        setAnalyzerDiagnostics(motionProvider.getDiagnostics())
        renderWindowStartedAt = now
        renderedFrames = 0
      }

      if (
        session.getState() === 'RUNNING' &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        typeof createImageBitmap === 'function'
      ) {
        void session.tick(now, video.currentTime, () => createImageBitmap(video))
      }
      animationFrame = requestAnimationFrame(render)
    }
    animationFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrame)
      if (sessionRef.current === session) sessionRef.current = null
      if (motionProviderRef.current === motionProvider) {
        motionProviderRef.current = null
      }
      void motionProvider.stop()
      void session.dispose()
    }
  }, [handleInferenceResult, handleSessionStateChange])

  const startCamera = async () => {
    const session = sessionRef.current
    if (!session) return
    if (typeof createImageBitmap !== 'function') {
      setError({
        code: 'UNSUPPORTED',
        message: 'This browser cannot create transferable video frames.',
      })
      return
    }

    setError(null)
    inferenceDurationsRef.current = []
    inferenceTimesRef.current = []
    setTelemetry((current) => ({
      ...current,
      actualHz: 0,
      meanInferenceMs: 0,
      p95InferenceMs: 0,
      droppedInferenceFrames: 0,
      modelStatus: 'LOADING',
      workerStatus: 'STARTING',
      poseDetected: false,
      lastResultAt: null,
      lastResultAgeMs: null,
    }))
    try {
      await motionProviderRef.current?.start(POSE_ANALYZER_REQUEST)
      setAnalyzerDiagnostics(
        motionProviderRef.current?.getDiagnostics() ?? null,
      )
      await session.start()
      if (session.getState() !== 'RUNNING') return
      const backend = session.getBackend()
      const adaptive = backend instanceof AdaptivePoseBackend ? backend : null
      const mode = backend?.mode ?? 'WORKER'
      const targetHz = mode === 'WORKER' ? 20 : 12
      setCameraSettings(session.getCameraSettings())
      setTelemetry((current) => ({
        ...current,
        backendMode: mode,
        fallbackReason: adaptive?.fallbackReason ?? null,
        targetHz,
        modelStatus: 'READY',
        workerStatus: mode === 'WORKER' ? 'READY' : 'FALLBACK',
      }))
    } catch (startupError) {
      await motionProviderRef.current?.stop()
      setAnalyzerDiagnostics(
        motionProviderRef.current?.getDiagnostics() ?? null,
      )
      setError(errorDetails(startupError))
      setTelemetry((current) => ({
        ...current,
        modelStatus: startupError instanceof CameraControllerError ? 'NOT_LOADED' : 'ERROR',
        workerStatus: startupError instanceof CameraControllerError ? 'NOT_STARTED' : 'ERROR',
      }))
    }
  }

  const stopCamera = async () => {
    await Promise.all([
      sessionRef.current?.stop(),
      motionProviderRef.current?.stop(),
    ])
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setCameraSettings(null)
    setTelemetry((current) => ({
      ...current,
      actualHz: 0,
      poseDetected: false,
      lastResultAt: null,
      lastResultAgeMs: null,
      modelStatus: 'CLOSED',
      workerStatus: 'CLOSED',
    }))
    setAnalyzerDiagnostics(
      motionProviderRef.current?.getDiagnostics() ?? null,
    )
  }

  const restartCamera = async () => {
    const session = sessionRef.current
    if (session?.getState() === 'RUNNING' || session?.getState() === 'STARTING') {
      await stopCamera()
    }
    await startCamera()
  }

  const sourceWidth = cameraSettings?.width ?? 16
  const sourceHeight = cameraSettings?.height ?? 9
  const lastResultAge = telemetry.lastResultAgeMs === null
    ? '—'
    : `${Math.max(0, telemetry.lastResultAgeMs).toFixed(0)} ms`
  const analyzerAction = (actionId: keyof NonNullable<PoseMotionAnalyzerSnapshot>['actions']) => {
    const value = analyzerDiagnostics?.actions[actionId]?.value
    return typeof value === 'number' ? value : 0
  }
  const moveLeft = analyzerAction('MOVE_LEFT')
  const moveRight = analyzerAction('MOVE_RIGHT')
  const leanLeft = analyzerAction('LEAN_LEFT')
  const leanRight = analyzerAction('LEAN_RIGHT')
  const jump = analyzerAction('JUMP')
  const analyzerFreshness = analyzerDiagnostics?.freshnessMs
  const analyzerFreshnessLabel =
    analyzerFreshness === null || analyzerFreshness === undefined
      ? '—'
      : `${analyzerFreshness.toFixed(0)} ms`

  return (
    <main className="pose-lab-shell">
      <header className="pose-lab-header">
        <div>
          <p>PHASE 1C · LOCAL MOTION ANALYZER DIAGNOSTIC</p>
          <h1>Pose + Motion Analyzer Lab</h1>
        </div>
        <button type="button" className="pose-button pose-button-quiet" onClick={onExit}>
          返回首頁
        </button>
      </header>

      <div className="pose-lab-layout">
        <section className="pose-preview-panel" aria-label="相機與姿勢預覽">
          <div className="pose-preview-stage">
            <div
              className="pose-media-layer"
              style={{ aspectRatio: `${sourceWidth} / ${sourceHeight}`, transform: MIRRORED_PREVIEW_TRANSFORM }}
            >
              <video ref={videoRef} muted playsInline aria-label="鏡像前置相機預覽" />
              <canvas ref={canvasRef} aria-label="姿勢骨架覆蓋層" />
            </div>
            <div className="pose-framing-guide" aria-hidden="true">
              <span>全身進入畫面</span>
            </div>
            {sessionState !== 'RUNNING' ? (
              <div className="pose-preview-state">
                <strong>
                  {sessionState === 'SUSPENDED'
                    ? '相機已暫停'
                    : sessionState === 'ERROR'
                      ? '感測器已停止'
                      : '相機尚未啟動'}
                </strong>
                <span>
                  {sessionState === 'ERROR'
                    ? '感測器錯誤已自動釋放相機，請點擊重新啟動。'
                    : sessionState === 'SUSPENDED'
                    ? '為保護隱私，請點擊重新啟動。'
                    : '只有按下啟動相機後才會要求權限。'}
                </span>
              </div>
            ) : null}
          </div>

          <div className="pose-controls">
            <button
              type="button"
              className="pose-button pose-button-primary"
              onClick={() => void startCamera()}
              disabled={sessionState === 'RUNNING' || sessionState === 'STARTING'}
            >
              啟動相機
            </button>
            <button
              type="button"
              className="pose-button"
              onClick={() => void stopCamera()}
              disabled={sessionState !== 'RUNNING' && sessionState !== 'STARTING'}
            >
              停止相機
            </button>
            <button
              type="button"
              className="pose-button"
              onClick={() => void restartCamera()}
              disabled={sessionState === 'STARTING'}
            >
              重新啟動
            </button>
          </div>

          {error ? (
            <p className="pose-error" role="alert">
              <strong>{error.code}</strong> {error.message}
            </p>
          ) : null}
        </section>

        <aside className="pose-telemetry" aria-label="本機感測器診斷資料">
          <h2>Local telemetry</h2>
          <dl>
            <TelemetryRow label="Camera state" value={sessionState} />
            <TelemetryRow
              label="Camera source"
              value={cameraSettings?.width && cameraSettings.height ? `${cameraSettings.width} × ${cameraSettings.height}` : '—'}
            />
            <TelemetryRow label="Camera FPS" value={cameraSettings?.frameRate?.toFixed(1) ?? '—'} />
            <TelemetryRow label="Facing mode" value={cameraSettings?.facingMode ?? '—'} />
            <TelemetryRow label="Backend" value={telemetry.backendMode} />
            <TelemetryRow label="Worker" value={telemetry.workerStatus} />
            <TelemetryRow label="Model" value={telemetry.modelStatus} />
            <TelemetryRow label="Target inference" value={`${telemetry.targetHz} Hz`} />
            <TelemetryRow label="Measured inference" value={`${formatNumber(telemetry.actualHz)} Hz`} />
            <TelemetryRow label="UI / render" value={`${formatNumber(telemetry.renderFps)} FPS`} />
            <TelemetryRow label="Mean inference" value={`${formatNumber(telemetry.meanInferenceMs)} ms`} />
            <TelemetryRow label="p95 inference" value={`${formatNumber(telemetry.p95InferenceMs)} ms`} />
            <TelemetryRow label="Dropped opportunities" value={String(telemetry.droppedInferenceFrames)} />
            <TelemetryRow label="Pose detected" value={telemetry.poseDetected ? 'YES' : 'NO'} />
            <TelemetryRow label="Last pose result" value={lastResultAge} />
          </dl>
          {telemetry.fallbackReason ? (
            <p className="pose-fallback-note">
              Fallback reason: {telemetry.fallbackReason}
            </p>
          ) : null}
          <h2>Motion Analyzer</h2>
          <dl>
            <TelemetryRow
              label="Tracking quality"
              value={analyzerDiagnostics?.quality ?? 'NOT_STARTED'}
            />
            <TelemetryRow
              label="Session baseline"
              value={
                analyzerDiagnostics?.baselineReady
                  ? 'READY'
                  : `${((analyzerDiagnostics?.baselineProgress ?? 0) * 100).toFixed(0)}%`
              }
            />
            <TelemetryRow label="Pose freshness" value={analyzerFreshnessLabel} />
            <TelemetryRow
              label="MOVE"
              value={
                moveLeft > 0
                  ? `LEFT ${formatNumber(moveLeft, 2)}`
                  : moveRight > 0
                    ? `RIGHT ${formatNumber(moveRight, 2)}`
                    : 'NEUTRAL'
              }
            />
            <TelemetryRow
              label="LEAN"
              value={
                leanLeft > 0
                  ? `LEFT ${formatNumber(leanLeft, 2)}`
                  : leanRight > 0
                    ? `RIGHT ${formatNumber(leanRight, 2)}`
                    : 'NEUTRAL'
              }
            />
            <TelemetryRow
              label="Left REACH"
              value={formatNumber(analyzerAction('REACH_LEFT'), 2)}
            />
            <TelemetryRow
              label="Right REACH"
              value={formatNumber(analyzerAction('REACH_RIGHT'), 2)}
            />
            <TelemetryRow
              label="SQUAT"
              value={`${analyzerDiagnostics?.squatState ?? 'STANDING'} ${formatNumber(analyzerAction('SQUAT'), 2)}`}
            />
            <TelemetryRow
              label="JUMP"
              value={`${analyzerDiagnostics?.jumpState ?? 'GROUNDED'}${jump > 0 ? ' · PULSE' : ''}`}
            />
            <TelemetryRow
              label="Analyzer time"
              value={`${formatNumber(analyzerDiagnostics?.analyzerDurationMs ?? 0, 3)} ms`}
            />
          </dl>
          <p className="pose-privacy-note">
            影像、landmarks 與暫時基準不會儲存、錄製或上傳到 Motion Arcade backend。
          </p>
        </aside>
      </div>
    </main>
  )
}

function TelemetryRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
