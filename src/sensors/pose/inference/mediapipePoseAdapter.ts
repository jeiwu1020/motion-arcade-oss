import type {
  Landmark,
  NormalizedLandmark,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

import type { PoseLandmark, PoseSensorFrame } from '../poseTypes'

function copyLandmark(landmark: NormalizedLandmark | Landmark): PoseLandmark {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }
}

export function copyPoseLandmarkerResult(
  result: PoseLandmarkerResult,
  timestampMs: number,
  sourceWidth: number,
  sourceHeight: number,
): PoseSensorFrame {
  return {
    timestampMs,
    sourceWidth,
    sourceHeight,
    poses: result.landmarks.slice(0, 1).map((landmarks, poseIndex) => ({
      landmarks: landmarks.map(copyLandmark),
      worldLandmarks: result.worldLandmarks[poseIndex]?.map(copyLandmark),
    })),
  }
}
