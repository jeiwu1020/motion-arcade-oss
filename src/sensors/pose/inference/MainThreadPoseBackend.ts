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

export class MainThreadPoseBackend implements PoseInferenceBackend {
  readonly mode = 'MAIN_THREAD_FALLBACK' as const
  private landmarker: PoseLandmarker | null = null

  async initialize(): Promise<void> {
    if (this.landmarker) return
    try {
      const fileset = await FilesetResolver.forVisionTasks(POSE_WASM_BASE_URL)
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_ASSET_URL },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      })
    } catch {
      throw new PoseBackendError(
        'MODEL_LOAD_FAILED',
        'Pose Landmarker Lite could not be initialized.',
      )
    }
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
    this.landmarker?.close()
    this.landmarker = null
  }
}
