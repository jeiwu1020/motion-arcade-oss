import type { ResolvedAbilityProfile } from '../adaptive/profiles'
import type { PlayerCalibration } from '../contracts/motion'
import {
  POSE_MOTION_CONFIG,
  type DirectionalBodyRangeConfig,
  type PoseMotionConfig,
  type ReachNormalizationConfig,
} from '../pose/poseMotionConfig'

interface RangeAdaptationLimits {
  readonly minimumMeasuredBodyUnits: number
  readonly maximumMeasuredBodyUnits: number
  readonly enterFraction: number
  readonly exitFraction: number
  readonly fullIntensityFraction: number
  readonly minimumEnterBodyUnits: number
  readonly maximumEnterBodyUnits: number
  readonly minimumExitBodyUnits: number
  readonly maximumExitBodyUnits: number
  readonly minimumFullIntensityBodyUnits: number
  readonly maximumFullIntensityBodyUnits: number
}

export const POSE_CALIBRATION_ADAPTATION_LIMITS = Object.freeze({
  move: Object.freeze({
    minimumMeasuredBodyUnits: 0.16,
    maximumMeasuredBodyUnits: 1.5,
    enterFraction: 0.35,
    exitFraction: 0.55,
    fullIntensityFraction: 0.9,
    minimumEnterBodyUnits: 0.14,
    maximumEnterBodyUnits: 0.3,
    minimumExitBodyUnits: 0.08,
    maximumExitBodyUnits: 0.18,
    minimumFullIntensityBodyUnits: 0.3,
    maximumFullIntensityBodyUnits: 0.9,
  }),
  lean: Object.freeze({
    minimumMeasuredBodyUnits: 0.15,
    maximumMeasuredBodyUnits: 1.2,
    enterFraction: 0.35,
    exitFraction: 0.55,
    fullIntensityFraction: 0.9,
    minimumEnterBodyUnits: 0.12,
    maximumEnterBodyUnits: 0.24,
    minimumExitBodyUnits: 0.07,
    maximumExitBodyUnits: 0.14,
    minimumFullIntensityBodyUnits: 0.24,
    maximumFullIntensityBodyUnits: 0.7,
  }),
  reach: Object.freeze({
    minimumMeasuredCapability: 0.8,
    maximumMeasuredCapability: 1,
    minimumExtensionRatio: 0.75,
    minimumFullExtensionRatio: 0.82,
    maximumFullExtensionRatio: 1,
  }),
  squat: Object.freeze({
    minimumMeasuredDepthBodyUnits: 0.18,
    maximumMeasuredDepthBodyUnits: 1.2,
    enterFraction: 0.65,
    exitFraction: 0.55,
    fullDepthFraction: 0.95,
    minimumEnterDepthBodyUnits: 0.18,
    maximumEnterDepthBodyUnits: 0.32,
    minimumExitDepthBodyUnits: 0.1,
    maximumExitDepthBodyUnits: 0.18,
    minimumFullDepthBodyUnits: 0.22,
    maximumFullDepthBodyUnits: 0.75,
  }),
  reaction: Object.freeze({
    minimumScale: 1,
    maximumScale: 2.5,
    candidateGraceMsPerScale: 320,
    maximumCandidateGraceMs: 480,
  }),
})

/**
 * LOW_MOTION retains deliberate anatomical reach intent while making the
 * compact-space profile reachable without changing STANDARD gates.
 */
export const LOW_MOTION_REACH_GATES = Object.freeze({
  enterScore: 0.56,
  exitScore: 0.42,
  minimumElbowAngleDegrees: 138,
  minimumOutsideBodyUnits: 0.42,
  minimumExtensionRatio: 0.7,
})

export interface PoseMotionAdaptedActions {
  readonly move: { readonly left: boolean; readonly right: boolean }
  readonly lean: { readonly left: boolean; readonly right: boolean }
  readonly reach: { readonly left: boolean; readonly right: boolean }
  readonly squat: boolean
}

export interface ResolvedPoseMotionConfig {
  readonly source: 'STANDARD' | 'CALIBRATION_V1'
  readonly config: PoseMotionConfig
  readonly adapted: PoseMotionAdaptedActions
}

type V1Calibration = Extract<PlayerCalibration, { readonly version: 1 }>

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCanonicalV1(calibration: PlayerCalibration | undefined): calibration is V1Calibration {
  if (!isObject(calibration) || calibration.version !== 1) return false
  if (calibration.status !== 'COMPLETE' && calibration.status !== 'PARTIAL') return false
  if (!isObject(calibration.pose) || !isObject(calibration.steps) || !isObject(calibration.quality)) {
    return false
  }
  if (
    !isObject(calibration.pose.move) ||
    !isObject(calibration.pose.lean) ||
    !isObject(calibration.pose.reach) ||
    !isObject(calibration.pose.squat)
  ) return false
  const stepValues = ['NEUTRAL', 'MOVE', 'LEAN', 'REACH', 'SQUAT'] as const
  if (stepValues.some((step) => calibration.steps[step] !== 'COMPLETE' && calibration.steps[step] !== 'SKIPPED')) {
    return false
  }
  return (
    isFiniteNumber(calibration.quality.meanTrackingConfidence) &&
    calibration.quality.meanTrackingConfidence >= 0 &&
    calibration.quality.meanTrackingConfidence <= 1 &&
    isFiniteNumber(calibration.quality.validSampleCount) &&
    calibration.quality.validSampleCount >= 0 &&
    isFiniteNumber(calibration.quality.completedAtTimestampMs) &&
    calibration.quality.completedAtTimestampMs >= 0
  )
}

function validMeasurement(value: number | null, minimum: number, maximum: number): value is number {
  return isFiniteNumber(value) && value >= minimum && value <= maximum
}

function adaptRange(
  measurement: number,
  limits: RangeAdaptationLimits,
  abilityScale: number,
): DirectionalBodyRangeConfig {
  const enter = clamp(
    measurement * limits.enterFraction * abilityScale,
    limits.minimumEnterBodyUnits,
    limits.maximumEnterBodyUnits,
  )
  const full = clamp(
    measurement * limits.fullIntensityFraction * abilityScale,
    Math.max(limits.minimumFullIntensityBodyUnits, enter),
    limits.maximumFullIntensityBodyUnits,
  )
  const exit = clamp(
    enter * limits.exitFraction,
    limits.minimumExitBodyUnits,
    Math.min(limits.maximumExitBodyUnits, enter - 0.01),
  )
  return Object.freeze({
    enterBodyUnits: enter,
    exitBodyUnits: exit,
    fullIntensityBodyUnits: full,
  })
}

function scaleStandardRange(
  range: DirectionalBodyRangeConfig,
  limits: RangeAdaptationLimits,
  abilityScale: number,
): DirectionalBodyRangeConfig {
  const enter = clamp(
    range.enterBodyUnits * abilityScale,
    limits.minimumEnterBodyUnits,
    limits.maximumEnterBodyUnits,
  )
  return Object.freeze({
    enterBodyUnits: enter,
    exitBodyUnits: clamp(
      range.exitBodyUnits * abilityScale,
      limits.minimumExitBodyUnits,
      Math.min(limits.maximumExitBodyUnits, enter - 0.01),
    ),
    fullIntensityBodyUnits: clamp(
      range.fullIntensityBodyUnits * abilityScale,
      Math.max(limits.minimumFullIntensityBodyUnits, enter),
      limits.maximumFullIntensityBodyUnits,
    ),
  })
}

function adaptReach(
  capability: number,
  abilityScale: number,
): ReachNormalizationConfig {
  const limits = POSE_CALIBRATION_ADAPTATION_LIMITS.reach
  const calibratedFull = clamp(
    capability,
    limits.minimumFullExtensionRatio,
    limits.maximumFullExtensionRatio,
  )
  const scaledFull =
    limits.minimumExtensionRatio +
    (calibratedFull - limits.minimumExtensionRatio) * abilityScale
  return Object.freeze({
    minimumExtensionRatio: limits.minimumExtensionRatio,
    fullExtensionRatio: clamp(
      scaledFull,
      limits.minimumFullExtensionRatio,
      limits.maximumFullExtensionRatio,
    ),
  })
}

function freezeConfig(config: PoseMotionConfig): PoseMotionConfig {
  return Object.freeze({
    ...config,
    coordinateTransform: Object.freeze({ ...config.coordinateTransform }),
    move: Object.freeze({
      left: Object.freeze({ ...config.move.left }),
      right: Object.freeze({ ...config.move.right }),
    }),
    lean: Object.freeze({
      left: Object.freeze({ ...config.lean.left }),
      right: Object.freeze({ ...config.lean.right }),
    }),
    reach: Object.freeze({
      ...config.reach,
      left: Object.freeze({ ...config.reach.left }),
      right: Object.freeze({ ...config.reach.right }),
    }),
    squat: Object.freeze({ ...config.squat }),
    jump: Object.freeze({ ...config.jump }),
  })
}

function standardResult(): ResolvedPoseMotionConfig {
  return Object.freeze({
    source: 'STANDARD',
    config: POSE_MOTION_CONFIG,
    adapted: Object.freeze({
      move: Object.freeze({ left: false, right: false }),
      lean: Object.freeze({ left: false, right: false }),
      reach: Object.freeze({ left: false, right: false }),
      squat: false,
    }),
  })
}

function reactionCandidateGraceMs(reactionWindowScale: number): number {
  const limits = POSE_CALIBRATION_ADAPTATION_LIMITS.reaction
  const safeScale = isFiniteNumber(reactionWindowScale)
    ? clamp(reactionWindowScale, limits.minimumScale, limits.maximumScale)
    : limits.minimumScale
  return Math.round(
    clamp(
      (safeScale - 1) * limits.candidateGraceMsPerScale,
      0,
      limits.maximumCandidateGraceMs,
    ),
  )
}

export function resolvePoseMotionConfig(
  calibration: PlayerCalibration | undefined,
  abilityProfile: ResolvedAbilityProfile,
): ResolvedPoseMotionConfig {
  const abilityScale =
    isFiniteNumber(abilityProfile.requiredMotionRangeScale) &&
    abilityProfile.requiredMotionRangeScale > 0
      ? abilityProfile.requiredMotionRangeScale
      : 1
  const candidateGraceMs = reactionCandidateGraceMs(
    abilityProfile.reactionWindowScale,
  )
  const upperBodyMode = abilityProfile.bodyRange === 'UPPER_BODY'
  const lowMotion = abilityProfile.profileIds.includes('LOW_MOTION')
  const canonicalCalibration =
    !upperBodyMode &&
    isCanonicalV1(calibration) &&
    calibration.steps.NEUTRAL === 'COMPLETE'
      ? calibration
      : undefined
  if (
    !upperBodyMode &&
    !canonicalCalibration &&
    abilityScale === 1 &&
    candidateGraceMs === 0
  ) {
    return standardResult()
  }
  const adapted = {
    move: {
      left:
        canonicalCalibration !== undefined && canonicalCalibration.steps.MOVE === 'COMPLETE' &&
        validMeasurement(
          canonicalCalibration.pose.move.leftRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.maximumMeasuredBodyUnits,
        ),
      right:
        canonicalCalibration !== undefined && canonicalCalibration.steps.MOVE === 'COMPLETE' &&
        validMeasurement(
          canonicalCalibration.pose.move.rightRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.maximumMeasuredBodyUnits,
        ),
    },
    lean: {
      left:
        canonicalCalibration !== undefined && canonicalCalibration.steps.LEAN === 'COMPLETE' &&
        validMeasurement(
          canonicalCalibration.pose.lean.leftRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.maximumMeasuredBodyUnits,
        ),
      right:
        canonicalCalibration !== undefined && canonicalCalibration.steps.LEAN === 'COMPLETE' &&
        validMeasurement(
          canonicalCalibration.pose.lean.rightRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.maximumMeasuredBodyUnits,
        ),
    },
    reach: {
      left:
        canonicalCalibration !== undefined && canonicalCalibration.steps.REACH === 'COMPLETE' &&
        validMeasurement(
          canonicalCalibration.pose.reach.leftCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.minimumMeasuredCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.maximumMeasuredCapability,
        ),
      right:
        canonicalCalibration !== undefined && canonicalCalibration.steps.REACH === 'COMPLETE' &&
        validMeasurement(
          canonicalCalibration.pose.reach.rightCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.minimumMeasuredCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.maximumMeasuredCapability,
        ),
    },
    squat:
      canonicalCalibration !== undefined && canonicalCalibration.steps.SQUAT === 'COMPLETE' &&
      validMeasurement(
        canonicalCalibration.pose.squat.comfortableDepthBodyUnits,
        POSE_CALIBRATION_ADAPTATION_LIMITS.squat.minimumMeasuredDepthBodyUnits,
        POSE_CALIBRATION_ADAPTATION_LIMITS.squat.maximumMeasuredDepthBodyUnits,
      ),
  }
  const anyAdapted =
    adapted.move.left || adapted.move.right ||
    adapted.lean.left || adapted.lean.right ||
    adapted.reach.left || adapted.reach.right ||
    adapted.squat
  const moveLeft = adapted.move.left && canonicalCalibration
    ? adaptRange(canonicalCalibration.pose.move.leftRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.move, abilityScale)
    : scaleStandardRange(
        POSE_MOTION_CONFIG.move.left,
        POSE_CALIBRATION_ADAPTATION_LIMITS.move,
        abilityScale,
      )
  const moveRight = adapted.move.right && canonicalCalibration
    ? adaptRange(canonicalCalibration.pose.move.rightRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.move, abilityScale)
    : scaleStandardRange(
        POSE_MOTION_CONFIG.move.right,
        POSE_CALIBRATION_ADAPTATION_LIMITS.move,
        abilityScale,
      )
  const leanLeft = adapted.lean.left && canonicalCalibration
    ? adaptRange(canonicalCalibration.pose.lean.leftRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.lean, abilityScale)
    : scaleStandardRange(
        POSE_MOTION_CONFIG.lean.left,
        POSE_CALIBRATION_ADAPTATION_LIMITS.lean,
        abilityScale,
      )
  const leanRight = adapted.lean.right && canonicalCalibration
    ? adaptRange(canonicalCalibration.pose.lean.rightRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.lean, abilityScale)
    : scaleStandardRange(
        POSE_MOTION_CONFIG.lean.right,
        POSE_CALIBRATION_ADAPTATION_LIMITS.lean,
        abilityScale,
      )
  const reachLeft = adapted.reach.left && canonicalCalibration
    ? adaptReach(canonicalCalibration.pose.reach.leftCapability as number, abilityScale)
    : adaptReach(POSE_MOTION_CONFIG.reach.left.fullExtensionRatio, abilityScale)
  const reachRight = adapted.reach.right && canonicalCalibration
    ? adaptReach(canonicalCalibration.pose.reach.rightCapability as number, abilityScale)
    : adaptReach(POSE_MOTION_CONFIG.reach.right.fullExtensionRatio, abilityScale)
  const squatLimits = POSE_CALIBRATION_ADAPTATION_LIMITS.squat
  const measuredSquat = adapted.squat && canonicalCalibration
    ? canonicalCalibration.pose.squat.comfortableDepthBodyUnits as number
    : 0
  const squatEnter = adapted.squat
    ? clamp(
        measuredSquat * squatLimits.enterFraction * abilityScale,
        squatLimits.minimumEnterDepthBodyUnits,
        squatLimits.maximumEnterDepthBodyUnits,
      )
    : POSE_MOTION_CONFIG.squat.enterDepthBodyUnits
  const squat = adapted.squat
    ? Object.freeze({
        enterDepthBodyUnits: squatEnter,
        exitDepthBodyUnits: clamp(
          squatEnter * squatLimits.exitFraction,
          squatLimits.minimumExitDepthBodyUnits,
          Math.min(squatLimits.maximumExitDepthBodyUnits, squatEnter - 0.01),
        ),
        fullDepthBodyUnits: clamp(
          measuredSquat * squatLimits.fullDepthFraction * abilityScale,
          Math.max(squatLimits.minimumFullDepthBodyUnits, squatEnter),
          squatLimits.maximumFullDepthBodyUnits,
        ),
        maximumEnterKneeAngleDegrees:
          POSE_MOTION_CONFIG.squat.maximumEnterKneeAngleDegrees,
      })
    : abilityScale === 1
      ? POSE_MOTION_CONFIG.squat
      : (() => {
          const enterDepthBodyUnits = clamp(
            POSE_MOTION_CONFIG.squat.enterDepthBodyUnits * abilityScale,
            squatLimits.minimumEnterDepthBodyUnits,
            squatLimits.maximumEnterDepthBodyUnits,
          )
          return Object.freeze({
            enterDepthBodyUnits,
            exitDepthBodyUnits: clamp(
              POSE_MOTION_CONFIG.squat.exitDepthBodyUnits * abilityScale,
              squatLimits.minimumExitDepthBodyUnits,
              Math.min(
                squatLimits.maximumExitDepthBodyUnits,
                enterDepthBodyUnits - 0.01,
              ),
            ),
            fullDepthBodyUnits: clamp(
              POSE_MOTION_CONFIG.squat.fullDepthBodyUnits * abilityScale,
              Math.max(squatLimits.minimumFullDepthBodyUnits, enterDepthBodyUnits),
              squatLimits.maximumFullDepthBodyUnits,
            ),
            maximumEnterKneeAngleDegrees:
              POSE_MOTION_CONFIG.squat.maximumEnterKneeAngleDegrees,
          })
        })()

  const config = freezeConfig({
    ...POSE_MOTION_CONFIG,
    bodyTrackingMode: upperBodyMode ? 'UPPER_BODY' : 'FULL_BODY',
    detectorCandidateGraceMs: candidateGraceMs,
    move: { left: moveLeft, right: moveRight },
    lean: { left: leanLeft, right: leanRight },
    reach: {
      ...POSE_MOTION_CONFIG.reach,
      ...(lowMotion
        ? {
            enterScore: LOW_MOTION_REACH_GATES.enterScore,
            exitScore: LOW_MOTION_REACH_GATES.exitScore,
            minimumElbowAngleDegrees:
              LOW_MOTION_REACH_GATES.minimumElbowAngleDegrees,
            minimumOutsideBodyUnits:
              LOW_MOTION_REACH_GATES.minimumOutsideBodyUnits,
          }
        : {}),
      left: {
        ...reachLeft,
        ...(lowMotion
          ? { minimumExtensionRatio: LOW_MOTION_REACH_GATES.minimumExtensionRatio }
          : {}),
      },
      right: {
        ...reachRight,
        ...(lowMotion
          ? { minimumExtensionRatio: LOW_MOTION_REACH_GATES.minimumExtensionRatio }
          : {}),
      },
    },
    squat,
  })
  return Object.freeze({
    source: anyAdapted ? 'CALIBRATION_V1' : 'STANDARD',
    config,
    adapted: Object.freeze({
      move: Object.freeze({ ...adapted.move }),
      lean: Object.freeze({ ...adapted.lean }),
      reach: Object.freeze({ ...adapted.reach }),
      squat: adapted.squat,
    }),
  })
}
