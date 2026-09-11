import type { SpatialHand } from '../motion/contracts/spatial'
import {
  calculateContainFitRect,
  mapSpatialHandToMirroredStage,
  type CameraPresentationDimensions,
  type CameraStageDisplayPoint,
} from '../components/camera-presentation/spatialDisplayMapping'

export interface LogicalPlayfieldPoint {
  readonly x: number
  readonly y: number
}

export interface LogicalPlayfieldRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const PHASER_LOGICAL_PLAYFIELD: CameraPresentationDimensions =
  Object.freeze({
    width: 1280,
    height: 720,
  })

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

/** The centered stage-local rectangle occupied by Phaser Scale.FIT. */
export function calculateLogicalPlayfieldFitRect(
  stage: CameraPresentationDimensions,
  playfield: CameraPresentationDimensions = PHASER_LOGICAL_PLAYFIELD,
): LogicalPlayfieldRect | null {
  if (!hasPositiveFiniteDimensions(stage) || !hasPositiveFiniteDimensions(playfield)) {
    return null
  }

  const playfieldAspectRatio = playfield.width / playfield.height
  const stageAspectRatio = stage.width / stage.height
  const width =
    playfieldAspectRatio >= stageAspectRatio
      ? stage.width
      : stage.height * playfieldAspectRatio
  const height =
    playfieldAspectRatio >= stageAspectRatio
      ? stage.width / playfieldAspectRatio
      : stage.height

  return {
    x: (stage.width - width) / 2,
    y: (stage.height - height) / 2,
    width,
    height,
  }
}

/**
 * Converts a stage-local display point to the Phaser logical world. Points in
 * Scale.FIT letterbox/pillarbox space deliberately have no logical position.
 */
export function mapCameraStagePointToLogicalPlayfield(
  point: CameraStageDisplayPoint,
  stage: CameraPresentationDimensions,
  playfield: CameraPresentationDimensions = PHASER_LOGICAL_PLAYFIELD,
): LogicalPlayfieldPoint | null {
  const fitRect = calculateLogicalPlayfieldFitRect(stage, playfield)
  if (!fitRect || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null
  }

  if (
    point.x < fitRect.x ||
    point.x > fitRect.x + fitRect.width ||
    point.y < fitRect.y ||
    point.y > fitRect.y + fitRect.height
  ) {
    return null
  }

  return {
    x: ((point.x - fitRect.x) / fitRect.width) * playfield.width,
    y: ((point.y - fitRect.y) / fitRect.height) * playfield.height,
  }
}

/**
 * Composes the existing source-to-mirrored-stage mapping with the stage-to-
 * Phaser mapping. The source hand itself remains untouched.
 */
export function mapSpatialHandToLogicalPlayfield(
  hand: SpatialHand,
  source: CameraPresentationDimensions,
  stage: CameraPresentationDimensions,
  playfield: CameraPresentationDimensions = PHASER_LOGICAL_PLAYFIELD,
): LogicalPlayfieldPoint | null {
  const stagePoint = mapSpatialHandToMirroredStage(hand, source, stage)
  if (!stagePoint) return null

  return mapCameraStagePointToLogicalPlayfield(stagePoint, stage, playfield)
}

/**
 * The camera-image area which is simultaneously visible inside the Phaser
 * FIT canvas, expressed in Phaser logical world units for future target
 * placement. No intersection means there is no camera-backed interaction
 * region.
 */
export function calculateCameraVisibleLogicalWorldRect(
  source: CameraPresentationDimensions,
  stage: CameraPresentationDimensions,
  playfield: CameraPresentationDimensions = PHASER_LOGICAL_PLAYFIELD,
): LogicalPlayfieldRect | null {
  const cameraRect = calculateContainFitRect(source, stage)
  const playfieldRect = calculateLogicalPlayfieldFitRect(stage, playfield)
  if (!cameraRect || !playfieldRect) return null

  const left = Math.max(cameraRect.x, playfieldRect.x)
  const top = Math.max(cameraRect.y, playfieldRect.y)
  const right = Math.min(
    cameraRect.x + cameraRect.width,
    playfieldRect.x + playfieldRect.width,
  )
  const bottom = Math.min(
    cameraRect.y + cameraRect.height,
    playfieldRect.y + playfieldRect.height,
  )
  if (right < left || bottom < top) return null

  return {
    x: ((left - playfieldRect.x) / playfieldRect.width) * playfield.width,
    y: ((top - playfieldRect.y) / playfieldRect.height) * playfield.height,
    width: ((right - left) / playfieldRect.width) * playfield.width,
    height: ((bottom - top) / playfieldRect.height) * playfield.height,
  }
}
