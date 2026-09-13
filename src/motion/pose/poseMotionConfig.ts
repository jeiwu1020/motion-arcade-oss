import type { CoordinateTransform } from '../coordinates/normalizeCoordinates'

/** Which lower-body landmarks must be genuinely valid for FULL_BODY readiness. */
export type PoseLowerBodyReadiness = 'STRICT' | 'KNEES'

export interface DirectionalBodyRangeConfig {
  readonly enterBodyUnits: number
  readonly exitBodyUnits: number
  readonly fullIntensityBodyUnits: number
}

export interface ReachNormalizationConfig {
  readonly minimumExtensionRatio: number
  readonly fullExtensionRatio: number
}

export interface PoseMotionConfig {
  readonly bodyTrackingMode: 'FULL_BODY' | 'UPPER_BODY'
  /** STRICT requires knees and ankles; KNEES keeps ankles optional for compact spaces. */
  readonly lowerBodyReadiness: PoseLowerBodyReadiness
  readonly coordinateTransform: CoordinateTransform
  readonly minimumLandmarkConfidence: number
  readonly staleAfterMs: number
  readonly resetBaselineAfterLossMs: number
  readonly baselineDurationMs: number
  readonly baselineMinimumSamples: number
  /** Maximum timestamp gap that preserves an in-progress FULL_BODY baseline. */
  readonly fullBodyBaselineGapGraceMs: number
  readonly baselineStabilityBodyUnits: number
  readonly smoothingAlpha: number
  readonly detectorDebounceFrames: number
  readonly detectorCandidateGraceMs: number
  readonly move: {
    readonly left: DirectionalBodyRangeConfig
    readonly right: DirectionalBodyRangeConfig
  }
  readonly lean: {
    readonly left: DirectionalBodyRangeConfig
    readonly right: DirectionalBodyRangeConfig
  }
  readonly reach: {
    readonly enterScore: number
    readonly exitScore: number
    readonly minimumElbowAngleDegrees: number
    readonly minimumOutsideBodyUnits: number
    readonly left: ReachNormalizationConfig
    readonly right: ReachNormalizationConfig
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

const STANDARD_MOVE_RANGE = Object.freeze({
  enterBodyUnits: 0.22,
  exitBodyUnits: 0.12,
  fullIntensityBodyUnits: 0.75,
})

const STANDARD_LEAN_RANGE = Object.freeze({
  enterBodyUnits: 0.18,
  exitBodyUnits: 0.1,
  fullIntensityBodyUnits: 0.55,
})

const STANDARD_REACH_NORMALIZATION = Object.freeze({
  minimumExtensionRatio: 0.75,
  fullExtensionRatio: 1,
})

export const POSE_MOTION_CONFIG: PoseMotionConfig = Object.freeze({
  bodyTrackingMode: 'FULL_BODY',
  lowerBodyReadiness: 'STRICT',
  coordinateTransform: Object.freeze({ sourceCoordinates: 'MIRRORED' as const }),
  minimumLandmarkConfidence: 0.55,
  staleAfterMs: 250,
  resetBaselineAfterLossMs: 1_200,
  baselineDurationMs: 800,
  baselineMinimumSamples: 8,
  fullBodyBaselineGapGraceMs: 350,
  baselineStabilityBodyUnits: 0.18,
  smoothingAlpha: 0.55,
  detectorDebounceFrames: 2,
  detectorCandidateGraceMs: 0,
  move: Object.freeze({
    left: STANDARD_MOVE_RANGE,
    right: STANDARD_MOVE_RANGE,
  }),
  lean: Object.freeze({
    left: STANDARD_LEAN_RANGE,
    right: STANDARD_LEAN_RANGE,
  }),
  reach: Object.freeze({
    enterScore: 0.68,
    exitScore: 0.5,
    minimumElbowAngleDegrees: 150,
    minimumOutsideBodyUnits: 0.55,
    left: STANDARD_REACH_NORMALIZATION,
    right: STANDARD_REACH_NORMALIZATION,
  }),
  squat: Object.freeze({
    enterDepthBodyUnits: 0.3,
    exitDepthBodyUnits: 0.16,
    fullDepthBodyUnits: 0.65,
    maximumEnterKneeAngleDegrees: 155,
  }),
  jump: Object.freeze({
    takeoffRiseBodyUnits: 0.1,
    takeoffVelocityBodyUnitsPerSecond: 1.2,
    minimumFootRiseBodyUnits: 0.08,
    airborneRiseBodyUnits: 0.32,
    landingRiseBodyUnits: 0.08,
    candidateWindowMs: 180,
    refractoryMs: 500,
  }),
})
