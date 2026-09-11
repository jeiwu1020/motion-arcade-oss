import type {
  SpatialHand,
  SpatialHandSnapshot,
} from '../contracts/spatial'
import { PoseFeatureExtractor } from '../pose/PoseFeatureExtractor'
import { POSE_MOTION_CONFIG } from '../pose/poseMotionConfig'
import type { PoseFeaturePoint } from '../pose/poseMotionTypes'
import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'

export interface PoseSpatialHandTrackerOptions {
  readonly staleAfterMs?: number
  readonly minimumLandmarkConfidence?: number
}

function unavailable(timestampMs: number, sequence: number): SpatialHand {
  return Object.freeze({
    availability: 'UNAVAILABLE' as const,
    timestampMs,
    sequence,
  })
}

function sourcePosition(
  point: PoseFeaturePoint,
  timestampMs: number,
  sequence: number,
): SpatialHand {
  const inSourceBounds =
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  if (!point.valid || !inSourceBounds) return unavailable(timestampMs, sequence)
  return Object.freeze({
    availability: 'AVAILABLE' as const,
    x: point.x,
    y: point.y,
    confidence: point.confidence,
    timestampMs,
    sequence,
  })
}

function snapshot(
  timestampMs: number,
  sequence: number,
  leftHand: SpatialHand,
  rightHand: SpatialHand,
): SpatialHandSnapshot {
  return Object.freeze({
    timestampMs,
    sequence,
    leftHand,
    rightHand,
  })
}

/**
 * Extracts only source-image-normalized Pose wrist positions. It deliberately
 * does not use aspect-corrected or body-relative feature values as screen
 * coordinates, and it has no camera, MediaPipe, DOM, or game ownership.
 */
export class PoseSpatialHandTracker {
  readonly #extractor: PoseFeatureExtractor
  readonly #staleAfterMs: number
  #sequence = 0
  #snapshot: SpatialHandSnapshot

  constructor(options: PoseSpatialHandTrackerOptions = {}) {
    const minimumLandmarkConfidence =
      options.minimumLandmarkConfidence ?? POSE_MOTION_CONFIG.minimumLandmarkConfidence
    this.#extractor = new PoseFeatureExtractor({ minimumLandmarkConfidence })
    this.#staleAfterMs = options.staleAfterMs ?? POSE_MOTION_CONFIG.staleAfterMs
    this.#snapshot = snapshot(
      0,
      0,
      unavailable(0, 0),
      unavailable(0, 0),
    )
  }

  reset(timestampMs = 0): void {
    this.#sequence += 1
    this.#snapshot = snapshot(
      timestampMs,
      this.#sequence,
      unavailable(timestampMs, this.#sequence),
      unavailable(timestampMs, this.#sequence),
    )
  }

  ingest(frame: PoseSensorFrame): void {
    const features = this.#extractor.extract(frame)
    const sequence = ++this.#sequence
    this.#snapshot = snapshot(
      frame.timestampMs,
      sequence,
      sourcePosition(features.leftWrist, frame.timestampMs, sequence),
      sourcePosition(features.rightWrist, frame.timestampMs, sequence),
    )
  }

  getSnapshot(nowMs: number): SpatialHandSnapshot {
    if (nowMs - this.#snapshot.timestampMs <= this.#staleAfterMs) {
      return this.#snapshot
    }
    return snapshot(
      this.#snapshot.timestampMs,
      this.#snapshot.sequence,
      unavailable(this.#snapshot.timestampMs, this.#snapshot.sequence),
      unavailable(this.#snapshot.timestampMs, this.#snapshot.sequence),
    )
  }
}
