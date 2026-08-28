import type { PoseLandmark } from './poseTypes'

export const MIRRORED_PREVIEW_TRANSFORM = 'scaleX(-1)'

export function toRawOverlayPoint(
  landmark: PoseLandmark,
  width: number,
  height: number,
): { readonly x: number; readonly y: number } {
  return { x: landmark.x * width, y: landmark.y * height }
}
