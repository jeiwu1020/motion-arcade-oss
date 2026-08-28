import { MainThreadPoseBackend } from './MainThreadPoseBackend'
import { PoseBackendError } from './PoseBackendError'
import type {
  PoseInferenceBackend,
  PoseInferenceInput,
} from './PoseInferenceBackend'
import { PoseWorkerClient } from './PoseWorkerClient'
import type { PoseBackendMode, PoseInferenceResult } from '../poseTypes'

export class AdaptivePoseBackend implements PoseInferenceBackend {
  private backend: PoseInferenceBackend | null = null
  private selectedMode: PoseBackendMode = 'WORKER'
  private reportedFallbackReason: string | null = null

  get mode(): PoseBackendMode {
    return this.selectedMode
  }

  get fallbackReason(): string | null {
    return this.reportedFallbackReason
  }

  async initialize(): Promise<void> {
    if (this.backend) return

    if (typeof Worker === 'undefined') {
      await this.initializeFallback('Web Worker is unavailable.')
      return
    }

    const workerBackend = new PoseWorkerClient()
    try {
      await workerBackend.initialize()
      this.backend = workerBackend
      this.selectedMode = 'WORKER'
    } catch (error) {
      await workerBackend.close()
      if (
        error instanceof PoseBackendError &&
        error.code === 'WORKER_INIT_FAILED'
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
    const fallback = new MainThreadPoseBackend()
    await fallback.initialize()
    this.backend = fallback
    this.selectedMode = 'MAIN_THREAD_FALLBACK'
    this.reportedFallbackReason = reason
  }
}
