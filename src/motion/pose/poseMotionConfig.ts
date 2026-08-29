import type { CoordinateTransform } from '../coordinates/normalizeCoordinates'

export interface PoseMotionConfig {
  readonly coordinateTransform: CoordinateTransform
  readonly minimumLandmarkConfidence: number
  readonly staleAfterMs: number
  readonly resetBaselineAfterLossMs: number
  readonly baselineDurationMs: number
  readonly baselineMinimumSamples: number
  readonly baselineStabilityBodyUnits: number
  readonly smoothingAlpha: number
  readonly detectorDebounceFrames: number
  readonly move: {
    readonly enterBodyUnits: number
    readonly exitBodyUnits: number
    readonly fullIntensityBodyUnits: number
  }
  readonly lean: {
    readonly enterBodyUnits: number
    readonly exitBodyUnits: number
    readonly fullIntensityBodyUnits: number
  }
  readonly reach: {
    readonly enterScore: number
    readonly exitScore: number
    readonly minimumElbowAngleDegrees: number
    readonly minimumOutsideBodyUnits: number
  }
  readonly squat: {
    readonly enterDepthBodyUnits: number
    readonly exitDepthBodyUnits: number
    readonly fullDepthBodyUnits: number
    readonly maximumEnterKneeAngleDegrees: number
  }
  readonly jump: {
    readonly takeoffRiseBodyUnits: number
    readonly takeoffVelocityBodyUnitsPerSecond: number
    readonly minimumFootRiseBodyUnits: number
    readonly airborneRiseBodyUnits: number
    readonly landingRiseBodyUnits: number
    readonly candidateWindowMs: number
    readonly refractoryMs: number
  }
}

export const POSE_MOTION_CONFIG: PoseMotionConfig = {
  coordinateTransform: { sourceCoordinates: 'MIRRORED' },
  minimumLandmarkConfidence: 0.55,
  staleAfterMs: 250,
  resetBaselineAfterLossMs: 1_200,
  baselineDurationMs: 800,
  baselineMinimumSamples: 8,
  baselineStabilityBodyUnits: 0.18,
  smoothingAlpha: 0.55,
  detectorDebounceFrames: 2,
  move: {
    enterBodyUnits: 0.22,
    exitBodyUnits: 0.12,
    fullIntensityBodyUnits: 0.75,
  },
  lean: {
    enterBodyUnits: 0.18,
    exitBodyUnits: 0.1,
    fullIntensityBodyUnits: 0.55,
  },
  reach: {
    enterScore: 0.68,
    exitScore: 0.5,
    minimumElbowAngleDegrees: 150,
    minimumOutsideBodyUnits: 0.55,
  },
  squat: {
    enterDepthBodyUnits: 0.3,
    exitDepthBodyUnits: 0.16,
    fullDepthBodyUnits: 0.65,
    maximumEnterKneeAngleDegrees: 155,
  },
  jump: {
    takeoffRiseBodyUnits: 0.1,
    takeoffVelocityBodyUnitsPerSecond: 1.2,
    minimumFootRiseBodyUnits: 0.08,
    airborneRiseBodyUnits: 0.32,
    landingRiseBodyUnits: 0.08,
    candidateWindowMs: 180,
    refractoryMs: 500,
  },
}
