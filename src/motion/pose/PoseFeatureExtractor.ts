import { clamp01 } from '../coordinates/normalizeCoordinates'
import type { PoseLandmark, PoseSensorFrame } from '../../sensors/pose/poseTypes'
import type {
  PoseArmFeature,
  PoseFeatureFrame,
  PoseFeaturePoint,
  PoseJointFeature,
} from './poseMotionTypes'

const LANDMARK_INDEX = {
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

export interface PoseFeatureExtractorOptions {
  readonly minimumLandmarkConfidence?: number
}

function confidenceOf(landmark: PoseLandmark | undefined): number {
  if (!landmark) return 0
  return clamp01(
    Math.min(landmark.visibility ?? 1, landmark.presence ?? 1),
  )
}

function pointOf(
  landmark: PoseLandmark | undefined,
  minimumConfidence: number,
): PoseFeaturePoint {
  const confidence = confidenceOf(landmark)
  const x = landmark?.x
  const y = landmark?.y
  const z = landmark?.z
  const xIsFinite = typeof x === 'number' && Number.isFinite(x)
  const yIsFinite = typeof y === 'number' && Number.isFinite(y)
  const zIsFinite = typeof z === 'number' && Number.isFinite(z)
  return {
    x: xIsFinite ? x : 0,
    y: yIsFinite ? y : 0,
    z: zIsFinite ? z : 0,
    confidence,
    valid:
      Boolean(landmark) &&
      xIsFinite &&
      yIsFinite &&
      confidence >= minimumConfidence,
  }
}

function midpoint(
  left: PoseFeaturePoint,
  right: PoseFeaturePoint,
): PoseFeaturePoint {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
    confidence: Math.min(left.confidence, right.confidence),
    valid: left.valid && right.valid,
  }
}

function distance(
  left: PoseFeaturePoint,
  right: PoseFeaturePoint,
  aspectRatio: number,
): number {
  return Math.hypot(
    (left.x - right.x) * aspectRatio,
    left.y - right.y,
  )
}

function angleDegrees(
  first: PoseFeaturePoint,
  vertex: PoseFeaturePoint,
  third: PoseFeaturePoint,
  aspectRatio: number,
): number {
  const firstX = (first.x - vertex.x) * aspectRatio
  const firstY = first.y - vertex.y
  const thirdX = (third.x - vertex.x) * aspectRatio
  const thirdY = third.y - vertex.y
  const denominator = Math.hypot(firstX, firstY) * Math.hypot(thirdX, thirdY)
  if (denominator <= Number.EPSILON) return 0
  const cosine = Math.max(
    -1,
    Math.min(1, (firstX * thirdX + firstY * thirdY) / denominator),
  )
  return (Math.acos(cosine) * 180) / Math.PI
}

function jointFeature(
  first: PoseFeaturePoint,
  vertex: PoseFeaturePoint,
  third: PoseFeaturePoint,
  aspectRatio: number,
): PoseJointFeature {
  const valid = first.valid && vertex.valid && third.valid
  return {
    angleDegrees: valid
      ? angleDegrees(first, vertex, third, aspectRatio)
      : 0,
    valid,
    confidence: Math.min(
      first.confidence,
      vertex.confidence,
      third.confidence,
    ),
  }
}

function armFeature(
  shoulder: PoseFeaturePoint,
  elbow: PoseFeaturePoint,
  wrist: PoseFeaturePoint,
  aspectRatio: number,
): PoseArmFeature {
  const valid = shoulder.valid && elbow.valid && wrist.valid
  const segmentLength =
    distance(shoulder, elbow, aspectRatio) +
    distance(elbow, wrist, aspectRatio)
  return {
    extensionRatio:
      valid && segmentLength > Number.EPSILON
        ? clamp01(distance(shoulder, wrist, aspectRatio) / segmentLength)
        : 0,
    elbowAngleDegrees: valid
      ? angleDegrees(shoulder, elbow, wrist, aspectRatio)
      : 0,
    valid,
    confidence: Math.min(
      shoulder.confidence,
      elbow.confidence,
      wrist.confidence,
    ),
  }
}

export class PoseFeatureExtractor {
  readonly #minimumConfidence: number

  constructor(options: PoseFeatureExtractorOptions = {}) {
    this.#minimumConfidence = clamp01(
      options.minimumLandmarkConfidence ?? 0.55,
    )
  }

  extract(frame: PoseSensorFrame): PoseFeatureFrame {
    const landmarks = frame.poses[0]?.landmarks ?? []
    const aspectRatio =
      frame.sourceWidth > 0 && frame.sourceHeight > 0
        ? frame.sourceWidth / frame.sourceHeight
        : 1
    const leftShoulder = pointOf(
      landmarks[LANDMARK_INDEX.leftShoulder],
      this.#minimumConfidence,
    )
    const rightShoulder = pointOf(
      landmarks[LANDMARK_INDEX.rightShoulder],
      this.#minimumConfidence,
    )
    const leftElbow = pointOf(
      landmarks[LANDMARK_INDEX.leftElbow],
      this.#minimumConfidence,
    )
    const rightElbow = pointOf(
      landmarks[LANDMARK_INDEX.rightElbow],
      this.#minimumConfidence,
    )
    const leftWrist = pointOf(
      landmarks[LANDMARK_INDEX.leftWrist],
      this.#minimumConfidence,
    )
    const rightWrist = pointOf(
      landmarks[LANDMARK_INDEX.rightWrist],
      this.#minimumConfidence,
    )
    const leftHip = pointOf(
      landmarks[LANDMARK_INDEX.leftHip],
      this.#minimumConfidence,
    )
    const rightHip = pointOf(
      landmarks[LANDMARK_INDEX.rightHip],
      this.#minimumConfidence,
    )
    const leftKneePoint = pointOf(
      landmarks[LANDMARK_INDEX.leftKnee],
      this.#minimumConfidence,
    )
    const rightKneePoint = pointOf(
      landmarks[LANDMARK_INDEX.rightKnee],
      this.#minimumConfidence,
    )
    const leftAnkle = pointOf(
      landmarks[LANDMARK_INDEX.leftAnkle],
      this.#minimumConfidence,
    )
    const rightAnkle = pointOf(
      landmarks[LANDMARK_INDEX.rightAnkle],
      this.#minimumConfidence,
    )
    const shoulderMidpoint = midpoint(leftShoulder, rightShoulder)
    const hipMidpoint = midpoint(leftHip, rightHip)
    const torsoCenter = midpoint(shoulderMidpoint, hipMidpoint)
    const torsoLength = distance(
      shoulderMidpoint,
      hipMidpoint,
      aspectRatio,
    )
    const shoulderWidth = distance(leftShoulder, rightShoulder, aspectRatio)
    const coreValid = shoulderMidpoint.valid && hipMidpoint.valid
    const fullBodyValid =
      coreValid &&
      leftKneePoint.valid &&
      rightKneePoint.valid &&
      leftAnkle.valid &&
      rightAnkle.valid
    const corePoints = [leftShoulder, rightShoulder, leftHip, rightHip]

    return {
      timestampMs: frame.timestampMs,
      posePresent: frame.poses.length > 0,
      aspectRatio,
      trackingConfidence: Math.min(...corePoints.map(({ confidence }) => confidence)),
      coreValid,
      fullBodyValid,
      shoulderMidpoint,
      hipMidpoint,
      torsoCenter,
      bodyCenter: torsoCenter,
      torsoLength,
      shoulderWidth,
      bodyScale: Math.max(torsoLength, shoulderWidth, Number.EPSILON),
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftHip,
      rightHip,
      leftKnee: jointFeature(
        leftHip,
        leftKneePoint,
        leftAnkle,
        aspectRatio,
      ),
      rightKnee: jointFeature(
        rightHip,
        rightKneePoint,
        rightAnkle,
        aspectRatio,
      ),
      leftAnkle,
      rightAnkle,
      leftArm: armFeature(
        leftShoulder,
        leftElbow,
        leftWrist,
        aspectRatio,
      ),
      rightArm: armFeature(
        rightShoulder,
        rightElbow,
        rightWrist,
        aspectRatio,
      ),
    }
  }
}
