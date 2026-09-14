import type { SportsMotionSnapshot } from '../contracts/sportsMotion'
import { PoseFeatureExtractor } from '../pose/PoseFeatureExtractor'
import { POSE_MOTION_CONFIG } from '../pose/poseMotionConfig'
import type { PoseFeatureFrame, PoseFeaturePoint } from '../pose/poseMotionTypes'
import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import {
  SportsMotionProvider,
  type SportsMotionKinematicHand,
} from './SportsMotionProvider'

export interface PoseSportsMotionTrackerOptions {
  readonly staleAfterMs?: number
  readonly minimumLandmarkConfidence?: number
}

function handSample(
  point: PoseFeaturePoint,
  features: PoseFeatureFrame,
): SportsMotionKinematicHand {
  const inSourceBounds =
    Number.isFinite(point.x) && point.x >= 0 && point.x <= 1 &&
    Number.isFinite(point.y) && point.y >= 0 && point.y <= 1
  if (!features.coreValid || !point.valid || !inSourceBounds) {
    return Object.freeze({ availability: 'UNAVAILABLE' as const })
  }
  return Object.freeze({
    availability: 'AVAILABLE' as const,
    x: point.x,
    y: point.y,
    confidence: point.confidence,
    aspectRatio: features.aspectRatio,
    bodyScale: features.bodyScale,
  })
}

/**
 * Reuses the already-inferred Pose frame to publish a separate, sanitized
 * sports-motion contract. It owns no camera, inference session, or game rule.
 */
export class PoseSportsMotionTracker {
  readonly #extractor: PoseFeatureExtractor
  readonly #provider = new SportsMotionProvider()
  readonly #staleAfterMs: number
  #lastStaleTimestamp: number | null = null

  constructor(options: PoseSportsMotionTrackerOptions = {}) {
    const minimumLandmarkConfidence =
      options.minimumLandmarkConfidence ?? POSE_MOTION_CONFIG.minimumLandmarkConfidence
    this.#extractor = new PoseFeatureExtractor({ minimumLandmarkConfidence })
    this.#staleAfterMs = options.staleAfterMs ?? POSE_MOTION_CONFIG.staleAfterMs
  }

  subscribe(listener: () => void): () => void {
    return this.#provider.subscribe(listener)
  }

  reset(timestampMs = 0): void {
    this.#lastStaleTimestamp = null
    this.#provider.reset(timestampMs)
  }

  ingest(frame: PoseSensorFrame): void {
    const features = this.#extractor.extract(frame)
    this.#lastStaleTimestamp = null
    if (!features.coreValid) {
      this.#provider.reset(frame.timestampMs)
      return
    }
    this.#provider.ingest({
      timestampMs: frame.timestampMs,
      leftHand: handSample(features.leftWrist, features),
      rightHand: handSample(features.rightWrist, features),
    })
  }

  getSnapshot(nowMs: number): SportsMotionSnapshot {
    const current = this.#provider.getSnapshot()
    if (
      nowMs - current.timestampMs > this.#staleAfterMs &&
      this.#lastStaleTimestamp !== current.timestampMs
    ) {
      this.#lastStaleTimestamp = current.timestampMs
      this.#provider.reset(current.timestampMs)
    }
    return this.#provider.getSnapshot()
  }
}
