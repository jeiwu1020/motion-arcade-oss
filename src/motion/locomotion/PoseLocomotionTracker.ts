import type { LocomotionSnapshot } from '../contracts/locomotion'
import { PoseFeatureExtractor } from '../pose/PoseFeatureExtractor'
import { POSE_MOTION_CONFIG } from '../pose/poseMotionConfig'
import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { LOCOMOTION_CONFIG } from './locomotionConfig'
import { LocomotionProvider } from './LocomotionProvider'

/**
 * Reuses an existing Pose inference result to expose compact-space locomotion.
 * Ankles are intentionally not part of its readiness requirement.
 */
export class PoseLocomotionTracker {
  readonly #extractor: PoseFeatureExtractor
  readonly #provider = new LocomotionProvider()

  constructor(minimumLandmarkConfidence = POSE_MOTION_CONFIG.minimumLandmarkConfidence) {
    this.#extractor = new PoseFeatureExtractor({ minimumLandmarkConfidence })
  }

  subscribe(listener: () => void): () => void {
    return this.#provider.subscribe(listener)
  }

  reset(timestampMs = 0): void {
    this.#provider.reset(timestampMs)
  }

  ingest(frame: PoseSensorFrame): void {
    const features = this.#extractor.extract(frame)
    if (
      !features.coreValid ||
      !features.kneesBodyValid ||
      !Number.isFinite(features.bodyScale) ||
      features.bodyScale < LOCOMOTION_CONFIG.minimumBodyScale
    ) {
      this.#provider.ingest({ availability: 'UNAVAILABLE', timestampMs: frame.timestampMs })
      return
    }
    this.#provider.ingest({
      availability: 'AVAILABLE',
      timestampMs: frame.timestampMs,
      rawKneeDifferenceBodyUnits:
        (features.rightKneePoint.y - features.leftKneePoint.y) / features.bodyScale,
    })
  }

  getSnapshot(nowMs: number): LocomotionSnapshot {
    return this.#provider.getSnapshot(nowMs)
  }
}
