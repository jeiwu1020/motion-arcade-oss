import { MainThreadPoseBackend } from './MainThreadPoseBackend'
import { PoseBackendError } from './PoseBackendError'
import type {
  PoseInferenceBackend,
  PoseInferenceInput,
} from './PoseInferenceBackend'
import { PoseWorkerClient } from './PoseWorkerClient'
import type { PoseBackendMode, PoseInferenceResult } from '../poseTypes'

interface AdaptivePoseBackendOptions {
  readonly workerAvailable?: (() => boolean) | undefined
  readonly createWorkerBackend?: (() => PoseInferenceBackend) | undefined
  readonly createFallbackBackend?: (() => PoseInferenceBackend) | undefined
}

export class AdaptivePoseBackend implements PoseInferenceBackend {
  private backend: PoseInferenceBackend | null = null
  private selectedMode: PoseBackendMode = 'WORKER'
  private reportedFallbackReason: string | null = null
  private readonly workerAvailable: () => boolean
  private readonly createWorkerBackend: () => PoseInferenceBackend
  private readonly createFallbackBackend: () => PoseInferenceBackend

  constructor(options: AdaptivePoseBackendOptions = {}) {
    this.workerAvailable = options.workerAvailable ?? (() => typeof Worker !== 'undefined')
    this.createWorkerBackend = options.createWorkerBackend ?? (() => new PoseWorkerClient())
    this.createFallbackBackend =
      options.createFallbackBackend ?? (() => new MainThreadPoseBackend())
  }

  get mode(): PoseBackendMode {
    return this.selectedMode
  }

  get fallbackReason(): string | null {
    return this.reportedFallbackReason
  }

  async initialize(): Promise<void> {
    if (this.backend) return

    if (!this.workerAvailable()) {
      await this.initializeFallback('Web Worker is unavailable.')
      return
    }

    const workerBackend = this.createWorkerBackend()
    try {
      await workerBackend.initialize()
      this.backend = workerBackend
      this.selectedMode = 'WORKER'
    } catch (error) {
      await workerBackend.close()
      if (
        error instanceof PoseBackendError &&
        (error.code === 'WORKER_INIT_FAILED' ||
          error.code === 'WORKER_INIT_TIMEOUT')
      ) {
        await this.initializeFallback(error.message)
        return
      }
      throw error
    }
  }

  infer(input: PoseInferenceInput): Promise<PoseInferenceResult> {
    if (!this.backend) {
      input.bitmap.close()
      return Promise.reject(
        new PoseBackendError('CLOSED', 'Pose backend is not initialized.'),
      )
    }
    return this.backend.infer(input)
  }

  async close(): Promise<void> {
    await this.backend?.close()
    this.backend = null
  }

  private async initializeFallback(reason: string): Promise<void> {
    const fallback = this.createFallbackBackend()
    try {
      await fallback.initialize()
      this.backend = fallback
      this.selectedMode = 'MAIN_THREAD_FALLBACK'
      this.reportedFallbackReason = reason
    } catch (error) {
      await fallback.close().catch(() => undefined)
      if (error instanceof PoseBackendError) throw error
      throw new PoseBackendError(
        'MODEL_LOAD_FAILED',
        'Pose fallback could not be initialized.',
      )
    }
  }
}
