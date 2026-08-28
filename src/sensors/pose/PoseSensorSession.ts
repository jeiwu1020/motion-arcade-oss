import type { CameraSettings } from '../camera/cameraTypes'
import type {
  PoseInferenceBackend,
  PoseInferenceInput,
} from './inference/PoseInferenceBackend'
import type { InferenceSchedulerStats } from './scheduling/InferenceScheduler'
import type { PoseInferenceResult, PoseSessionState } from './poseTypes'

interface SessionCamera {
  start(): Promise<MediaStream>
  stop(): void
  getSettings(): CameraSettings | null
}

interface SessionScheduler {
  start(): void
  stop(): void
  tick(
    nowMs: number,
    videoTime: number,
    createFrame: () => Promise<ImageBitmap>,
  ): Promise<boolean>
  getStats(): InferenceSchedulerStats
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

interface PoseSensorSessionOptions {
  readonly camera: SessionCamera
  readonly createBackend: () => PoseInferenceBackend
  readonly createScheduler: (
    backend: PoseInferenceBackend,
    onFatalInferenceError: (error: unknown) => Promise<void>,
  ) => SessionScheduler
  readonly documentTarget?: LifecycleDocument
  readonly windowTarget?: LifecycleWindow
  readonly onStateChange?: ((state: PoseSessionState) => void) | undefined
}

export class PoseSensorSession {
  private state: PoseSessionState = 'READY'
  private backend: PoseInferenceBackend | null = null
  private scheduler: SessionScheduler | null = null
  private cleanupPromise: Promise<void> | null = null
  private disposed = false
  private operationGeneration = 0
  private readonly documentTarget: LifecycleDocument
  private readonly windowTarget: LifecycleWindow
  private readonly options: PoseSensorSessionOptions

  constructor(options: PoseSensorSessionOptions) {
    this.options = options
    this.documentTarget = options.documentTarget ?? document
    this.windowTarget = options.windowTarget ?? window
    this.documentTarget.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    )
    this.windowTarget.addEventListener('pagehide', this.handlePageHide)
    this.options.onStateChange?.(this.state)
  }

  async start(): Promise<void> {
    if (this.disposed) throw new Error('Pose sensor session is disposed.')
    await this.cleanupPromise
    if (this.state === 'RUNNING' || this.state === 'STARTING') return

    const generation = ++this.operationGeneration
    this.setState('STARTING')
    try {
      await this.options.camera.start()
      if (generation !== this.operationGeneration) return

      const backend = this.options.createBackend()
      this.backend = backend
      await backend.initialize()
      if (generation !== this.operationGeneration) {
        if (this.backend === backend) {
          this.backend = null
          await backend.close()
        }
        return
      }

      const scheduler = this.options.createScheduler(
        backend,
        (error) => this.fail(error),
      )
      this.scheduler = scheduler
      scheduler.start()
      this.setState('RUNNING')
    } catch (error) {
      if (generation !== this.operationGeneration) return
      await this.releaseResources()
      this.setState('ERROR')
      throw error
    }
  }

  async stop(nextState: 'STOPPED' | 'SUSPENDED' = 'STOPPED'): Promise<void> {
    await this.releaseResources()
    this.setState(nextState)
  }

  async fail(_error: unknown): Promise<void> {
    if (this.state === 'ERROR' && !this.cleanupPromise) return
    await this.releaseResources()
    this.setState('ERROR')
  }

  async tick(
    nowMs: number,
    videoTime: number,
    createFrame: () => Promise<ImageBitmap>,
  ): Promise<boolean> {
    return (await this.scheduler?.tick(nowMs, videoTime, createFrame)) ?? false
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.documentTarget.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    )
    this.windowTarget.removeEventListener('pagehide', this.handlePageHide)
    await this.stop()
  }

  getState(): PoseSessionState {
    return this.state
  }

  getCameraSettings(): CameraSettings | null {
    return this.options.camera.getSettings()
  }

  getBackend(): PoseInferenceBackend | null {
    return this.backend
  }

  getSchedulerStats(): InferenceSchedulerStats | null {
    return this.scheduler?.getStats() ?? null
  }

  private setState(state: PoseSessionState): void {
    this.state = state
    this.options.onStateChange?.(state)
  }

  private releaseResources(): Promise<void> {
    if (this.cleanupPromise) return this.cleanupPromise

    this.operationGeneration += 1
    const scheduler = this.scheduler
    this.scheduler = null
    scheduler?.stop()

    this.options.camera.stop()
    const backend = this.backend
    this.backend = null
    const cleanup = Promise.resolve(backend?.close())
      .catch(() => undefined)
      .finally(() => {
        if (this.cleanupPromise === cleanup) this.cleanupPromise = null
      })
    this.cleanupPromise = cleanup
    return cleanup
  }

  private readonly handleVisibilityChange = () => {
    if (this.documentTarget.visibilityState === 'hidden') {
      void this.stop('SUSPENDED')
    }
  }

  private readonly handlePageHide = () => {
    void this.stop('SUSPENDED')
  }
}

export type { PoseInferenceInput, PoseInferenceResult }
