import type {
  PoseBackendMode,
  PoseInferenceResult,
} from '../poseTypes'

export interface PoseInferenceInput {
  readonly bitmap: ImageBitmap
  readonly timestampMs: number
  readonly sourceWidth: number
  readonly sourceHeight: number
}

export interface PoseInferenceBackend {
  readonly mode: PoseBackendMode
  initialize(): Promise<void>
  infer(input: PoseInferenceInput): Promise<PoseInferenceResult>
  close(): Promise<void>
}

export const POSE_WASM_BASE_URL = '/vendor/mediapipe/wasm'
export const POSE_MODEL_ASSET_URL =
  '/vendor/mediapipe/models/pose_landmarker_lite.task'
