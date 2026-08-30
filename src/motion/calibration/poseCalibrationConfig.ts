import type { CoordinateTransform } from '../coordinates/normalizeCoordinates'

export interface PoseCalibrationConfig {
  readonly coordinateTransform: CoordinateTransform
  readonly minimumTrackingConfidence: number
  readonly neutralDurationMs: number
  readonly neutralMinimumSamples: number
  readonly neutralMaximumCenterRangeBodyUnits: number
  readonly directionConfirmationFrames: number
  readonly movementMinimumRangeBodyUnits: number
  readonly movementMaximumLeanBodyUnits: number
  readonly leanMinimumRangeBodyUnits: number
  readonly reachPreparationFrames: number
  readonly reachMinimumCapability: number
  readonly reachMinimumElbowAngleDegrees: number
  readonly reachMinimumOutsideIncreaseBodyUnits: number
  readonly squatMinimumDepthBodyUnits: number
  readonly squatMaximumKneeAngleDegrees: number
  readonly trackingRecoveryFrames: number
}

export const POSE_CALIBRATION_CONFIG: PoseCalibrationConfig = {
  coordinateTransform: { sourceCoordinates: 'MIRRORED' },
  minimumTrackingConfidence: 0.55,
  neutralDurationMs: 750,
  neutralMinimumSamples: 8,
  neutralMaximumCenterRangeBodyUnits: 0.16,
  directionConfirmationFrames: 2,
  movementMinimumRangeBodyUnits: 0.25,
  movementMaximumLeanBodyUnits: 0.14,
  leanMinimumRangeBodyUnits: 0.18,
  reachPreparationFrames: 2,
  reachMinimumCapability: 0.8,
  reachMinimumElbowAngleDegrees: 145,
  reachMinimumOutsideIncreaseBodyUnits: 0.18,
  squatMinimumDepthBodyUnits: 0.18,
  squatMaximumKneeAngleDegrees: 165,
  trackingRecoveryFrames: 3,
}
