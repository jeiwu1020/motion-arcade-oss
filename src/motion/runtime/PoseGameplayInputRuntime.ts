import type { MotionInputRequest } from '../contracts/motion'
import type { SpatialHandSnapshot } from '../contracts/spatial'
import type { SportsMotionSnapshot } from '../contracts/sportsMotion'
import type { LocomotionSnapshot } from '../contracts/locomotion'
import type { PoseTrackingSnapshot } from '../contracts/poseTracking'
import { PoseMotionInputProvider } from '../pose/PoseMotionInputProvider'
import type { PoseMotionAnalyzerSnapshot } from '../pose/poseMotionTypes'
import { PoseSpatialHandTracker } from '../spatial/PoseSpatialHandTracker'
import { PoseSportsMotionTracker } from '../sports/PoseSportsMotionTracker'
import { PoseLocomotionTracker } from '../locomotion/PoseLocomotionTracker'
import { PoseTrackingSnapshotTracker } from '../tracking/PoseTrackingSnapshotTracker'
import {
  CameraController,
  CameraControllerError,
} from '../../sensors/camera/CameraController'
import type { CameraSettings } from '../../sensors/camera/cameraTypes'
import { AdaptivePoseBackend } from '../../sensors/pose/inference/AdaptivePoseBackend'
import { PoseBackendError } from '../../sensors/pose/inference/PoseBackendError'
import type { PoseInferenceBackend } from '../../sensors/pose/inference/PoseInferenceBackend'
import { PoseSensorSession } from '../../sensors/pose/PoseSensorSession'
import { InferenceScheduler } from '../../sensors/pose/scheduling/InferenceScheduler'
import type {
  PoseInferenceResult,
  PoseSessionState,
} from '../../sensors/pose/poseTypes'

export type PoseGameplayInputStatus =
  | 'CAMERA_NOT_STARTED'
  | 'PERMISSION_STARTING'
  | 'BASELINING'
  | 'READY'
  | 'TRACKING_LOST'
  | 'ERROR'

export interface PoseGameplayInputError {
  readonly code: string
  readonly message: string
}

export interface PoseGameplayInputSnapshot {
  readonly status: PoseGameplayInputStatus
  readonly error: PoseGameplayInputError | null
}

export interface PoseGameplayVideoSource {
  readonly readyState: number
  currentTime: number
  readonly videoWidth: number
  readonly videoHeight: number
}

interface PoseGameplayCamera {
  start(): Promise<MediaStream>
  stop(): void
  getSettings(): CameraSettings | null
}

interface LifecycleDocument {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

interface LifecycleWindow {
  addEventListener(type: 'pagehide', listener: () => void): void
  removeEventListener(type: 'pagehide', listener: () => void): void
}

export interface PoseGameplayInputRuntimeOptions {
  readonly getVideo: () => PoseGameplayVideoSource | null
  readonly provider?: PoseMotionInputProvider
  readonly camera?: PoseGameplayCamera
  readonly createBackend?: () => PoseInferenceBackend
  readonly createFrame?: (
    video: PoseGameplayVideoSource,
  ) => Promise<ImageBitmap>
  readonly now?: () => number
  readonly documentTarget?: LifecycleDocument
  readonly windowTarget?: LifecycleWindow
  /** Game-selected sensor readiness requirement; defaults preserve existing games. */
  readonly framingRequirement?: 'FULL_BODY' | 'UPPER_BODY'
}

type Listener = () => void

const INITIAL_SNAPSHOT: PoseGameplayInputSnapshot = Object.freeze({
  status: 'CAMERA_NOT_STARTED',
  error: null,
})

export const POSE_GAMEPLAY_RUNTIME_CONFIG = Object.freeze({
  readyLossGraceMs: 1_000,
})

function readableError(
  error: unknown,
  fallbackCode: string,
): PoseGameplayInputError {
  if (error instanceof CameraControllerError) {
    const messages: Readonly<Record<string, string>> = {
      UNSUPPORTED: '此瀏覽器不支援相機存取。',
      INSECURE_CONTEXT: '相機需要 HTTPS 安全連線。',
      PERMISSION_DENIED: '相機權限遭拒，請允許後再重試。',
      NO_CAMERA: '找不到可使用的相機。',
      CAMERA_BUSY: '相機正在被其他程式使用。',
      VIDEO_START_FAILED: '相機已開啟，但預覽無法啟動。',
      CAMERA_START_FAILED: '相機無法啟動，請稍後重試。',
      STOPPED: '相機啟動已取消。',
    }
    return {
      code: error.code,
      message: messages[error.code] ?? '相機無法啟動，請稍後重試。',
    }
  }
  if (error instanceof PoseBackendError) {
    return {
      code: error.code,
      message: '姿勢辨識無法啟動，請重新載入後再試。',
    }
  }
  return {
    code: fallbackCode,
    message:
      fallbackCode === 'INFERENCE_FAILED'
        ? '姿勢辨識中斷，請重新啟動相機。'
        : '相機或姿勢辨識啟動失敗，請稍後重試。',
  }
}

/**
 * Shared production boundary that owns camera, Pose inference, and the
 * normalized Pose provider while exposing only readiness and provider output
 * to gameplay. It never advances game rules or renders the playfield.
 */
export class PoseGameplayInputRuntime {
  readonly #options: PoseGameplayInputRuntimeOptions
  readonly #now: () => number
  readonly #provider: PoseMotionInputProvider
  readonly #spatialHands = new PoseSpatialHandTracker()
  readonly #sportsMotion = new PoseSportsMotionTracker()
  readonly #locomotion = new PoseLocomotionTracker()
  readonly #poseTracking = new PoseTrackingSnapshotTracker()
  readonly #listeners = new Set<Listener>()
  #session: PoseSensorSession | null = null
  #snapshot = INITIAL_SNAPSHOT
  #hasBeenReady = false
  #lastFullyReadyAtMs: number | undefined
  #disposed = false
  #operationGeneration = 0
  #startPromise: Promise<void> | null = null

  constructor(options: PoseGameplayInputRuntimeOptions) {
    this.#options = options
    this.#now = options.now ?? (() => performance.now())
    this.#provider =
      options.provider ??
      new PoseMotionInputProvider({ now: this.#now })
  }

  readonly getSnapshot = (): PoseGameplayInputSnapshot => this.#snapshot

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  getProvider(): PoseMotionInputProvider {
    return this.#provider
  }

  /**
   * Canonical, source-image-normalized anatomical wrist positions from the
   * same Pose frames as the action provider. This never exposes raw frames or
   * participates in Phaser/playfield mapping.
   */
  getSpatialSnapshot(): SpatialHandSnapshot {
    return this.#spatialHands.getSnapshot(this.#now())
  }

  /** Sanitized, body-relative wrist swing output from the same Pose frames. */
  getSportsMotionSnapshot(): SportsMotionSnapshot {
    return this.#sportsMotion.getSnapshot(this.#now())
  }

  /** Sanitized compact-space alternating knee-lift output from the same Pose frames. */
  getLocomotionSnapshot(): LocomotionSnapshot {
    return this.#locomotion.getSnapshot(this.#now())
  }

  /** Sanitized selected-joint feedback for Camera Presentation only. */
  getPoseTrackingSnapshot(): PoseTrackingSnapshot {
    return this.#poseTracking.getSnapshot(this.#now())
  }

  start(request: MotionInputRequest): Promise<void> {
    if (this.#disposed) {
      return Promise.reject(new Error('Pose gameplay runtime is disposed.'))
    }
    if (this.#startPromise) return this.#startPromise
    if (
      this.#session?.getState() === 'RUNNING' &&
      this.#provider.isRunning()
    ) {
      return Promise.resolve()
    }

    const generation = ++this.#operationGeneration
    const startPromise = this.#start(generation, request)
    this.#startPromise = startPromise
    void startPromise.finally(() => {
      if (this.#startPromise === startPromise) this.#startPromise = null
    }).catch(() => undefined)
    return startPromise
  }

  async stop(): Promise<void> {
    this.#operationGeneration += 1
    this.#startPromise = null
    this.#hasBeenReady = false
    this.#lastFullyReadyAtMs = undefined
    this.#spatialHands.reset(this.#now())
    this.#sportsMotion.reset(this.#now())
    this.#locomotion.reset(this.#now())
    this.#poseTracking.reset(this.#now())
    await Promise.all([
      this.#session?.stop(),
      this.#provider.stop(),
    ])
    this.#setSnapshot('CAMERA_NOT_STARTED', null)
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    this.#operationGeneration += 1
    this.#startPromise = null
    this.#hasBeenReady = false
    this.#lastFullyReadyAtMs = undefined
    this.#spatialHands.reset(this.#now())
    this.#sportsMotion.reset(this.#now())
    this.#locomotion.reset(this.#now())
    this.#poseTracking.reset(this.#now())
    const session = this.#session
    this.#session = null
    await Promise.all([session?.dispose(), this.#provider.stop()])
    this.#setSnapshot('CAMERA_NOT_STARTED', null)
    this.#listeners.clear()
  }

  async update(nowMs: number): Promise<void> {
    this.#provider.update(0)
    this.#refreshReadiness()

    const session = this.#session
    const video = this.#options.getVideo()
    if (
      !session ||
      session.getState() !== 'RUNNING' ||
      !video ||
      video.readyState < 2 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return
    }

    await session.tick(nowMs, video.currentTime, () => this.#createFrame(video))
    this.#provider.update(0)
    this.#refreshReadiness()
  }

  async #start(
    generation: number,
    request: MotionInputRequest,
  ): Promise<void> {
    this.#hasBeenReady = false
    this.#lastFullyReadyAtMs = undefined
    this.#sportsMotion.reset(this.#now())
    this.#locomotion.reset(this.#now())
    this.#setSnapshot('PERMISSION_STARTING', null)

    try {
      await this.#provider.start(request)
      const session = this.#ensureSession()
      await session.start()
      if (generation !== this.#operationGeneration) return
      this.#refreshReadiness()
    } catch (error) {
      if (generation !== this.#operationGeneration) return
      await this.#provider.stop()
      this.#setSnapshot('ERROR', readableError(error, 'START_FAILED'))
      throw error
    }
  }

  #ensureSession(): PoseSensorSession {
    if (this.#session) return this.#session

    const video = this.#options.getVideo()
    if (!video) throw new Error('Pose gameplay video is unavailable.')
    if (!this.#options.createFrame && typeof createImageBitmap !== 'function') {
      throw new Error('ImageBitmap is unavailable.')
    }

    const camera =
      this.#options.camera ??
      new CameraController(video as HTMLVideoElement)
    this.#session = new PoseSensorSession({
      camera,
      createBackend:
        this.#options.createBackend ?? (() => new AdaptivePoseBackend()),
      createScheduler: (backend, onFatalInferenceError) => {
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
          onResult: (result) => this.#handleInferenceResult(result),
          onError: (error) => {
            this.#setSnapshot(
              'ERROR',
              readableError(error, 'INFERENCE_FAILED'),
            )
            return onFatalInferenceError(error)
          },
        })
      },
      ...(this.#options.documentTarget
        ? { documentTarget: this.#options.documentTarget }
        : {}),
      ...(this.#options.windowTarget
        ? { windowTarget: this.#options.windowTarget }
        : {}),
      onStateChange: (state) => this.#handleSessionStateChange(state),
    })
    return this.#session
  }

  #createFrame(video: PoseGameplayVideoSource): Promise<ImageBitmap> {
    if (this.#options.createFrame) return this.#options.createFrame(video)
    return createImageBitmap(video as HTMLVideoElement)
  }

  #handleInferenceResult(result: PoseInferenceResult): void {
    this.#spatialHands.ingest(result.frame)
    this.#sportsMotion.ingest(result.frame)
    this.#locomotion.ingest(result.frame)
    this.#poseTracking.ingest(result.frame)
    this.#provider.ingest(result.frame)
    this.#refreshReadiness()
  }

  #handleSessionStateChange(state: PoseSessionState): void {
    if (state === 'STARTING') {
      this.#setSnapshot('PERMISSION_STARTING', null)
      return
    }
    if (state === 'RUNNING') {
      this.#refreshReadiness()
      return
    }
    if (state === 'STOPPED' || state === 'SUSPENDED') {
      this.#hasBeenReady = false
      this.#lastFullyReadyAtMs = undefined
      this.#spatialHands.reset(this.#now())
      this.#sportsMotion.reset(this.#now())
      this.#locomotion.reset(this.#now())
      this.#poseTracking.reset(this.#now())
      void this.#provider.stop()
      this.#setSnapshot('CAMERA_NOT_STARTED', null)
      return
    }
    if (state === 'ERROR') {
      this.#hasBeenReady = false
      this.#lastFullyReadyAtMs = undefined
      this.#spatialHands.reset(this.#now())
      this.#sportsMotion.reset(this.#now())
      this.#locomotion.reset(this.#now())
      this.#poseTracking.reset(this.#now())
      void this.#provider.stop()
      this.#setSnapshot(
        'ERROR',
        this.#snapshot.error ?? {
          code: 'SENSOR_ERROR',
          message: '相機或姿勢辨識已停止，請重新啟動。',
        },
      )
    }
  }

  #refreshReadiness(): void {
    if (this.#session?.getState() !== 'RUNNING') return
    const diagnostics = this.#provider.getDiagnostics()
    const nowMs = this.#now()
    if (this.#isStandardReady(diagnostics)) {
      this.#hasBeenReady = true
      this.#lastFullyReadyAtMs = nowMs
      this.#setSnapshot('READY', null)
      return
    }
    const withinReadyLossGrace =
      this.#hasBeenReady &&
      this.#lastFullyReadyAtMs !== undefined &&
      Math.max(0, nowMs - this.#lastFullyReadyAtMs) <=
        POSE_GAMEPLAY_RUNTIME_CONFIG.readyLossGraceMs
    if (withinReadyLossGrace) {
      this.#setSnapshot('READY', null)
      return
    }
    this.#setSnapshot(
      this.#hasBeenReady ? 'TRACKING_LOST' : 'BASELINING',
      null,
    )
  }

  #isStandardReady(diagnostics: PoseMotionAnalyzerSnapshot): boolean {
    return (
      diagnostics.quality === 'READY' &&
      diagnostics.baselineReady &&
      (this.#options.framingRequirement === 'UPPER_BODY'
        ? diagnostics.upperBodyReady
        : diagnostics.fullBodyReady)
    )
  }

  #setSnapshot(
    status: PoseGameplayInputStatus,
    error: PoseGameplayInputError | null,
  ): void {
    if (
      this.#snapshot.status === status &&
      this.#snapshot.error?.code === error?.code &&
      this.#snapshot.error?.message === error?.message
    ) {
      return
    }
    this.#snapshot = Object.freeze({ status, error })
    for (const listener of this.#listeners) listener()
  }
}
