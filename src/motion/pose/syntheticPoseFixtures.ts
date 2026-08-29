import type {
  PoseLandmark,
  PoseSensorFrame,
} from '../../sensors/pose/poseTypes'

export type SyntheticPoseName =
  | 'neutral'
  | 'move-left'
  | 'move-right'
  | 'lean-left'
  | 'lean-right'
  | 'reach-left'
  | 'reach-right'
  | 'squat'
  | 'jump-takeoff'
  | 'jump-airborne'

const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_ELBOW = 13
const RIGHT_ELBOW = 14
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_HIP = 23
const RIGHT_HIP = 24
const LEFT_KNEE = 25
const RIGHT_KNEE = 26
const LEFT_ANKLE = 27
const RIGHT_ANKLE = 28

function landmark(
  x: number,
  y: number,
  visibility = 0.99,
): PoseLandmark {
  return { x, y, z: 0, visibility, presence: visibility }
}

function neutralLandmarks(): PoseLandmark[] {
  const landmarks = Array.from({ length: 33 }, () => landmark(0.5, 0.15))
  landmarks[LEFT_SHOULDER] = landmark(0.57, 0.3)
  landmarks[RIGHT_SHOULDER] = landmark(0.43, 0.3)
  landmarks[LEFT_ELBOW] = landmark(0.6, 0.43)
  landmarks[RIGHT_ELBOW] = landmark(0.4, 0.43)
  landmarks[LEFT_WRIST] = landmark(0.61, 0.57)
  landmarks[RIGHT_WRIST] = landmark(0.39, 0.57)
  landmarks[LEFT_HIP] = landmark(0.54, 0.52)
  landmarks[RIGHT_HIP] = landmark(0.46, 0.52)
  landmarks[LEFT_KNEE] = landmark(0.54, 0.72)
  landmarks[RIGHT_KNEE] = landmark(0.46, 0.72)
  landmarks[LEFT_ANKLE] = landmark(0.54, 0.92)
  landmarks[RIGHT_ANKLE] = landmark(0.46, 0.92)
  return landmarks
}

function translate(
  landmarks: PoseLandmark[],
  deltaX: number,
  deltaY: number,
): void {
  for (let index = 0; index < landmarks.length; index += 1) {
    const point = landmarks[index]
    if (!point) continue
    landmarks[index] = { ...point, x: point.x + deltaX, y: point.y + deltaY }
  }
}

export interface SyntheticPoseOptions {
  readonly timestampMs?: number
  readonly confidence?: number
  readonly missingPose?: boolean
  readonly sourceWidth?: number
  readonly sourceHeight?: number
}

export function createSyntheticPoseFrame(
  name: SyntheticPoseName,
  options: SyntheticPoseOptions = {},
): PoseSensorFrame {
  const landmarks = neutralLandmarks()

  if (name === 'move-left') translate(landmarks, 0.08, 0)
  if (name === 'move-right') translate(landmarks, -0.08, 0)
  if (name === 'lean-left') {
    landmarks[LEFT_SHOULDER] = landmark(0.63, 0.3)
    landmarks[RIGHT_SHOULDER] = landmark(0.49, 0.3)
  }
  if (name === 'lean-right') {
    landmarks[LEFT_SHOULDER] = landmark(0.51, 0.3)
    landmarks[RIGHT_SHOULDER] = landmark(0.37, 0.3)
  }
  if (name === 'reach-left') {
    landmarks[LEFT_ELBOW] = landmark(0.69, 0.34)
    landmarks[LEFT_WRIST] = landmark(0.81, 0.32)
  }
  if (name === 'reach-right') {
    landmarks[RIGHT_ELBOW] = landmark(0.31, 0.34)
    landmarks[RIGHT_WRIST] = landmark(0.19, 0.32)
  }
  if (name === 'squat') {
    landmarks[LEFT_HIP] = landmark(0.54, 0.64)
    landmarks[RIGHT_HIP] = landmark(0.46, 0.64)
    landmarks[LEFT_KNEE] = landmark(0.61, 0.73)
    landmarks[RIGHT_KNEE] = landmark(0.39, 0.73)
  }
  if (name === 'jump-takeoff') translate(landmarks, 0, -0.04)
  if (name === 'jump-airborne') translate(landmarks, 0, -0.12)

  const confidence = options.confidence ?? 0.99
  const confidentLandmarks = landmarks.map((point) => ({
    ...point,
    visibility: confidence,
    presence: confidence,
  }))

  return {
    timestampMs: options.timestampMs ?? 0,
    sourceWidth: options.sourceWidth ?? 1280,
    sourceHeight: options.sourceHeight ?? 720,
    poses: options.missingPose
      ? []
      : [{ landmarks: confidentLandmarks }],
  }
}

export function withLandmarkConfidence(
  frame: PoseSensorFrame,
  landmarkIndex: number,
  confidence: number,
): PoseSensorFrame {
  const pose = frame.poses[0]
  if (!pose) return frame
  const landmarks = pose.landmarks.map((point, index) =>
    index === landmarkIndex
      ? { ...point, visibility: confidence, presence: confidence }
      : point,
  )
  return { ...frame, poses: [{ ...pose, landmarks }] }
}

export function withPoseTranslation(
  frame: PoseSensorFrame,
  deltaX: number,
  deltaY: number,
): PoseSensorFrame {
  const pose = frame.poses[0]
  if (!pose) return frame
  return {
    ...frame,
    poses: [
      {
        ...pose,
        landmarks: pose.landmarks.map((point) => ({
          ...point,
          x: point.x + deltaX,
          y: point.y + deltaY,
        })),
      },
    ],
  }
}
