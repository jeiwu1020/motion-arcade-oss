import type {
  PoseTrackingJoints,
  PoseTrackingPoint,
  PoseTrackingSnapshot,
} from '../contracts/poseTracking'
import { POSE_MOTION_CONFIG } from '../pose/poseMotionConfig'
import type { PoseLandmark, PoseSensorFrame } from '../../sensors/pose/poseTypes'

const SELECTED_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

export interface PoseTrackingSnapshotTrackerOptions {
  readonly staleAfterMs?: number
  readonly minimumLandmarkConfidence?: number
}

function confidenceOf(landmark: PoseLandmark | undefined): number {
  if (!landmark) return 0
  const confidence = Math.min(landmark.visibility ?? 1, landmark.presence ?? 1)
  return Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0
}

function unavailablePoint(): PoseTrackingPoint {
  return Object.freeze({ x: null, y: null, confidence: 0, valid: false })
}

function trackingPoint(
  landmark: PoseLandmark | undefined,
  minimumConfidence: number,
): PoseTrackingPoint {
  if (!landmark) return unavailablePoint()
  const x = landmark.x
  const y = landmark.y
  const coordinatesUsable =
    Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
  if (!coordinatesUsable) return unavailablePoint()
  const confidence = confidenceOf(landmark)
  return Object.freeze({
    x,
    y,
    confidence,
    valid: confidence >= minimumConfidence,
  })
}

function emptyJoints(): PoseTrackingJoints {
  return Object.freeze({
    leftShoulder: unavailablePoint(), rightShoulder: unavailablePoint(),
    leftElbow: unavailablePoint(), rightElbow: unavailablePoint(),
    leftWrist: unavailablePoint(), rightWrist: unavailablePoint(),
    leftHip: unavailablePoint(), rightHip: unavailablePoint(),
    leftKnee: unavailablePoint(), rightKnee: unavailablePoint(),
    leftAnkle: unavailablePoint(), rightAnkle: unavailablePoint(),
  })
}

function snapshot(
  timestampMs: number,
  sequence: number,
  posePresent: boolean,
  joints: PoseTrackingJoints,
): PoseTrackingSnapshot {
  return Object.freeze({ timestampMs, sequence, posePresent, joints })
}

/**
 * Sanitizes one live Pose sample for camera-presentation feedback. It keeps no
 * raw frame/landmark reference and expires display points with Pose freshness.
 */
export class PoseTrackingSnapshotTracker {
  readonly #minimumConfidence: number
  readonly #staleAfterMs: number
  #sequence = 0
  #snapshot: PoseTrackingSnapshot

  constructor(options: PoseTrackingSnapshotTrackerOptions = {}) {
    this.#minimumConfidence = options.minimumLandmarkConfidence ?? POSE_MOTION_CONFIG.minimumLandmarkConfidence
    this.#staleAfterMs = options.staleAfterMs ?? POSE_MOTION_CONFIG.staleAfterMs
    this.#snapshot = snapshot(0, 0, false, emptyJoints())
  }

  ingest(frame: PoseSensorFrame): void {
    const landmarks = frame.poses[0]?.landmarks
    const sequence = ++this.#sequence
    if (!landmarks) {
      this.#snapshot = snapshot(frame.timestampMs, sequence, false, emptyJoints())
      return
    }
    const joints = Object.freeze(Object.fromEntries(
      Object.entries(SELECTED_LANDMARKS).map(([name, index]) => [
        name,
        trackingPoint(landmarks[index], this.#minimumConfidence),
      ]),
    )) as unknown as PoseTrackingJoints
    this.#snapshot = snapshot(frame.timestampMs, sequence, true, joints)
  }

  getSnapshot(nowMs: number): PoseTrackingSnapshot {
    if (nowMs - this.#snapshot.timestampMs <= this.#staleAfterMs) return this.#snapshot
    return snapshot(this.#snapshot.timestampMs, this.#snapshot.sequence, false, emptyJoints())
  }

  reset(timestampMs = 0): void {
    this.#sequence += 1
    this.#snapshot = snapshot(timestampMs, this.#sequence, false, emptyJoints())
  }
}
