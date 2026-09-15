import {
  FilesetResolver,
  PoseLandmarker,
} from '@mediapipe/tasks-vision'

import { copyPoseLandmarkerResult } from './mediapipePoseAdapter'
import { PoseBackendError } from './PoseBackendError'
import {
  POSE_MODEL_ASSET_URL,
  POSE_WASM_BASE_URL,
  type PoseInferenceBackend,
  type PoseInferenceInput,
} from './PoseInferenceBackend'
import type { PoseInferenceResult } from '../poseTypes'
import { POSE_STARTUP_TIMEOUTS, withStartupTimeout } from '../../startup/StartupTimeouts'

export interface MainThreadPoseBackendOptions {
  readonly initializationTimeoutMs?: number | undefined
  readonly createLandmarker?: (() => Promise<PoseLandmarker>) | undefined
}

export class MainThreadPoseBackend implements PoseInferenceBackend {
  readonly mode = 'MAIN_THREAD_FALLBACK' as const
  private landmarker: PoseLandmarker | null = null
  private lifecycleGeneration = 0
  private initializePromise: Promise<void> | null = null
  private readonly initializationTimeoutMs: number
  private readonly createLandmarker: () => Promise<PoseLandmarker>

  constructor(options: MainThreadPoseBackendOptions = {}) {
    this.initializationTimeoutMs =
      options.initializationTimeoutMs ?? POSE_STARTUP_TIMEOUTS.mainThreadInitializationMs
    this.createLandmarker = options.createLandmarker ?? (async () => {
      const fileset = await FilesetResolver.forVisionTasks(POSE_WASM_BASE_URL)
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_ASSET_URL },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      })
    })
  }

  initialize(): Promise<void> {
    if (this.landmarker) return Promise.resolve()
    if (this.initializePromise) return this.initializePromise
    const generation = this.lifecycleGeneration
    const initialization = withStartupTimeout(
      this.loadLandmarker(generation),
      this.initializationTimeoutMs,
      () => new PoseBackendError(
        'MODEL_LOAD_TIMEOUT',
        'Pose Landmarker Lite initialization timed out.',
      ),
      () => this.cancelGeneration(generation),
    )
    this.initializePromise = initialization
    void initialization.finally(() => {
      if (this.initializePromise === initialization) this.initializePromise = null
    }).catch(() => undefined)
    return initialization
  }

  async infer(input: PoseInferenceInput): Promise<PoseInferenceResult> {
    if (!this.landmarker) {
      input.bitmap.close()
      throw new PoseBackendError('CLOSED', 'Pose backend is not initialized.')
    }

    const startedAt = performance.now()
    try {
      const result = this.landmarker.detectForVideo(
        input.bitmap,
        input.timestampMs,
      )
      try {
        return {
          frame: copyPoseLandmarkerResult(
            result,
            input.timestampMs,
            input.sourceWidth,
            input.sourceHeight,
          ),
          inferenceDurationMs: performance.now() - startedAt,
        }
      } finally {
        result.close()
      }
    } catch (error) {
      if (error instanceof PoseBackendError) throw error
      throw new PoseBackendError('INFERENCE_FAILED', 'Pose inference failed.')
    } finally {
      input.bitmap.close()
    }
  }

  async close(): Promise<void> {
    this.lifecycleGeneration += 1
    this.landmarker?.close()
    this.landmarker = null
  }

  private async loadLandmarker(generation: number): Promise<void> {
    try {
      const landmarker = await this.createLandmarker()
      if (generation !== this.lifecycleGeneration) {
        landmarker.close()
        throw new PoseBackendError('CLOSED', 'Pose backend was closed.')
      }
      this.landmarker = landmarker
    } catch (error) {
      if (error instanceof PoseBackendError) throw error
      throw new PoseBackendError(
        'MODEL_LOAD_FAILED',
        'Pose Landmarker Lite could not be initialized.',
      )
    }
  }

  private cancelGeneration(generation: number): void {
    if (this.lifecycleGeneration === generation) this.lifecycleGeneration += 1
  }
}
