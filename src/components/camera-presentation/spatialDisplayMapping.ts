import type { SpatialHand } from '../../motion/contracts/spatial'

export interface CameraPresentationDimensions {
  readonly width: number
  readonly height: number
}

export interface CameraContainFitRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface CameraSourceNormalizedPoint {
  readonly x: number
  readonly y: number
}

export interface CameraStageDisplayPoint {
  readonly x: number
  readonly y: number
}

function hasPositiveFiniteDimensions(
  dimensions: CameraPresentationDimensions,
): boolean {
  return (
    Number.isFinite(dimensions.width) &&
    Number.isFinite(dimensions.height) &&
    dimensions.width > 0 &&
    dimensions.height > 0
  )
}

/**
 * The actual source-video rectangle rendered by `object-fit: contain`, in
 * stage-local CSS pixels. It intentionally does not know about display
 * mirroring, anatomy, or Phaser/playfield coordinates.
 */
export function calculateContainFitRect(
  source: CameraPresentationDimensions,
  stage: CameraPresentationDimensions,
): CameraContainFitRect | null {
  if (!hasPositiveFiniteDimensions(source) || !hasPositiveFiniteDimensions(stage)) {
    return null
  }

  const sourceAspectRatio = source.width / source.height
  const stageAspectRatio = stage.width / stage.height
  const width =
    sourceAspectRatio >= stageAspectRatio
      ? stage.width
      : stage.height * sourceAspectRatio
  const height =
    sourceAspectRatio >= stageAspectRatio
      ? stage.width / sourceAspectRatio
      : stage.height

  return {
    x: (stage.width - width) / 2,
    y: (stage.height - height) / 2,
    width,
    height,
  }
}

/**
 * Maps a canonical, unmirrored source-image point into the mirrored DOM
 * camera preview. Mirroring is deliberately applied only here; `y` remains
 * source-top to source-bottom and source values are never mutated.
 */
export function mapCanonicalSourcePointToMirroredStage(
  point: CameraSourceNormalizedPoint,
  source: CameraPresentationDimensions,
  stage: CameraPresentationDimensions,
): CameraStageDisplayPoint | null {
  const videoRect = calculateContainFitRect(source, stage)
  if (!videoRect) return null

  return {
    x: videoRect.x + (1 - point.x) * videoRect.width,
    y: videoRect.y + point.y * videoRect.height,
  }
}

/**
 * Returns a visible display point only for a currently available canonical
 * spatial hand. An unavailable hand remains coordinate-free in the
 * presentation layer as well.
 */
export function mapSpatialHandToMirroredStage(
  hand: SpatialHand,
  source: CameraPresentationDimensions,
  stage: CameraPresentationDimensions,
): CameraStageDisplayPoint | null {
  if (hand.availability === 'UNAVAILABLE') return null

  return mapCanonicalSourcePointToMirroredStage(hand, source, stage)
}
