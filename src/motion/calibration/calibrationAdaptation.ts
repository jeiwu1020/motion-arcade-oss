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

export function resolvePoseMotionConfig(
  calibration: PlayerCalibration | undefined,
  abilityProfile: ResolvedAbilityProfile,
): ResolvedPoseMotionConfig {
  if (!isCanonicalV1(calibration) || calibration.steps.NEUTRAL !== 'COMPLETE') {
    return standardResult()
  }
  const abilityScale =
    isFiniteNumber(abilityProfile.requiredMotionRangeScale) &&
    abilityProfile.requiredMotionRangeScale > 0
      ? abilityProfile.requiredMotionRangeScale
      : 1
  const adapted = {
    move: {
      left:
        calibration.steps.MOVE === 'COMPLETE' &&
        validMeasurement(
          calibration.pose.move.leftRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.maximumMeasuredBodyUnits,
        ),
      right:
        calibration.steps.MOVE === 'COMPLETE' &&
        validMeasurement(
          calibration.pose.move.rightRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.move.maximumMeasuredBodyUnits,
        ),
    },
    lean: {
      left:
        calibration.steps.LEAN === 'COMPLETE' &&
        validMeasurement(
          calibration.pose.lean.leftRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.maximumMeasuredBodyUnits,
        ),
      right:
        calibration.steps.LEAN === 'COMPLETE' &&
        validMeasurement(
          calibration.pose.lean.rightRangeBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.minimumMeasuredBodyUnits,
          POSE_CALIBRATION_ADAPTATION_LIMITS.lean.maximumMeasuredBodyUnits,
        ),
    },
    reach: {
      left:
        calibration.steps.REACH === 'COMPLETE' &&
        validMeasurement(
          calibration.pose.reach.leftCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.minimumMeasuredCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.maximumMeasuredCapability,
        ),
      right:
        calibration.steps.REACH === 'COMPLETE' &&
        validMeasurement(
          calibration.pose.reach.rightCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.minimumMeasuredCapability,
          POSE_CALIBRATION_ADAPTATION_LIMITS.reach.maximumMeasuredCapability,
        ),
    },
    squat:
      calibration.steps.SQUAT === 'COMPLETE' &&
      validMeasurement(
        calibration.pose.squat.comfortableDepthBodyUnits,
        POSE_CALIBRATION_ADAPTATION_LIMITS.squat.minimumMeasuredDepthBodyUnits,
        POSE_CALIBRATION_ADAPTATION_LIMITS.squat.maximumMeasuredDepthBodyUnits,
      ),
  }
  const anyAdapted =
    adapted.move.left || adapted.move.right ||
    adapted.lean.left || adapted.lean.right ||
    adapted.reach.left || adapted.reach.right ||
    adapted.squat
  if (!anyAdapted) return standardResult()

  const moveLeft = adapted.move.left
    ? adaptRange(calibration.pose.move.leftRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.move, abilityScale)
    : POSE_MOTION_CONFIG.move.left
  const moveRight = adapted.move.right
    ? adaptRange(calibration.pose.move.rightRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.move, abilityScale)
    : POSE_MOTION_CONFIG.move.right
  const leanLeft = adapted.lean.left
    ? adaptRange(calibration.pose.lean.leftRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.lean, abilityScale)
    : POSE_MOTION_CONFIG.lean.left
  const leanRight = adapted.lean.right
    ? adaptRange(calibration.pose.lean.rightRangeBodyUnits as number, POSE_CALIBRATION_ADAPTATION_LIMITS.lean, abilityScale)
    : POSE_MOTION_CONFIG.lean.right
  const reachLeft = adapted.reach.left
    ? adaptReach(calibration.pose.reach.leftCapability as number, abilityScale)
    : POSE_MOTION_CONFIG.reach.left
  const reachRight = adapted.reach.right
    ? adaptReach(calibration.pose.reach.rightCapability as number, abilityScale)
    : POSE_MOTION_CONFIG.reach.right
  const squatLimits = POSE_CALIBRATION_ADAPTATION_LIMITS.squat
  const measuredSquat = calibration.pose.squat.comfortableDepthBodyUnits as number
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
    : POSE_MOTION_CONFIG.squat

  const config = freezeConfig({
    ...POSE_MOTION_CONFIG,
    move: { left: moveLeft, right: moveRight },
    lean: { left: leanLeft, right: leanRight },
    reach: {
      ...POSE_MOTION_CONFIG.reach,
      left: reachLeft,
      right: reachRight,
    },
    squat,
  })
  return Object.freeze({
    source: 'CALIBRATION_V1',
    config,
    adapted: Object.freeze({
      move: Object.freeze({ ...adapted.move }),
      lean: Object.freeze({ ...adapted.lean }),
      reach: Object.freeze({ ...adapted.reach }),
      squat: adapted.squat,
    }),
  })
}
