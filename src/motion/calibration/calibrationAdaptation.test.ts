import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { PlayerCalibration } from '../contracts/motion'
import { POSE_MOTION_CONFIG } from '../pose/poseMotionConfig'
import {
  POSE_CALIBRATION_ADAPTATION_LIMITS,
  resolvePoseMotionConfig,
} from './calibrationAdaptation'

const STANDARD = resolveAbilityProfile(['STANDARD'])

function calibration(overrides: {
  readonly moveLeft?: number | null
  readonly moveRight?: number | null
  readonly leanLeft?: number | null
  readonly leanRight?: number | null
  readonly reachLeft?: number | null
  readonly reachRight?: number | null
  readonly squat?: number | null
  readonly skipped?: readonly ('MOVE' | 'LEAN' | 'REACH' | 'SQUAT')[]
} = {}): Extract<PlayerCalibration, { readonly version: 1 }> {
  const skipped = new Set(overrides.skipped ?? [])
  return {
    version: 1,
    status: skipped.size === 0 ? 'COMPLETE' : 'PARTIAL',
    pose: {
      move: {
        leftRangeBodyUnits: overrides.moveLeft ?? 0.3,
        rightRangeBodyUnits: overrides.moveRight ?? 0.55,
      },
      lean: {
        leftRangeBodyUnits: overrides.leanLeft ?? 0.25,
        rightRangeBodyUnits: overrides.leanRight ?? 0.5,
      },
      reach: {
        leftCapability: overrides.reachLeft ?? 0.9,
        rightCapability: overrides.reachRight ?? 0.98,
      },
      squat: {
        comfortableDepthBodyUnits: overrides.squat ?? 0.22,
      },
    },
    steps: {
      NEUTRAL: 'COMPLETE',
      MOVE: skipped.has('MOVE') ? 'SKIPPED' : 'COMPLETE',
      LEAN: skipped.has('LEAN') ? 'SKIPPED' : 'COMPLETE',
      REACH: skipped.has('REACH') ? 'SKIPPED' : 'COMPLETE',
      SQUAT: skipped.has('SQUAT') ? 'SKIPPED' : 'COMPLETE',
    },
    quality: {
      meanTrackingConfidence: 0.95,
      validSampleCount: 42,
      completedAtTimestampMs: 5_000,
    },
  }
}

describe('resolvePoseMotionConfig validation and fallback', () => {
  it('preserves every STANDARD detector value without calibration', () => {
    const resolved = resolvePoseMotionConfig(undefined, STANDARD)

    expect(resolved.source).toBe('STANDARD')
    expect(resolved.config).toEqual(POSE_MOTION_CONFIG)
    expect(resolved.config.move.left).toEqual({
      enterBodyUnits: 0.22,
      exitBodyUnits: 0.12,
      fullIntensityBodyUnits: 0.75,
    })
    expect(resolved.config.lean.right).toEqual({
      enterBodyUnits: 0.18,
      exitBodyUnits: 0.1,
      fullIntensityBodyUnits: 0.55,
    })
    expect(resolved.config.squat).toEqual({
      enterDepthBodyUnits: 0.3,
      exitDepthBodyUnits: 0.16,
      fullDepthBodyUnits: 0.65,
      maximumEnterKneeAngleDegrees: 155,
    })
    expect(resolved.config.jump).toEqual(POSE_MOTION_CONFIG.jump)
  })

  it('rejects the deprecated compatibility calibration shape', () => {
    const deprecated: PlayerCalibration = {
      neutralPosition: { x: 0.5, y: 0.5 },
      leftUsableExtent: 0.1,
      rightUsableExtent: 0.1,
    }

    const resolved = resolvePoseMotionConfig(deprecated, STANDARD)

    expect(resolved.source).toBe('STANDARD')
    expect(resolved.config).toEqual(POSE_MOTION_CONFIG)
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -0.3],
    ['zero', 0],
    ['implausibly tiny', 0.01],
  ])('falls back only the malformed %s measurement', (_label, invalid) => {
    const resolved = resolvePoseMotionConfig(
      calibration({ moveLeft: invalid }),
      STANDARD,
    )

    expect(resolved.config.move.left).toEqual(POSE_MOTION_CONFIG.move.left)
    expect(resolved.config.move.right.fullIntensityBodyUnits).toBeCloseTo(0.495)
    expect(resolved.adapted.move).toEqual({ left: false, right: true })
  })

  it('rejects malformed runtime objects even when they claim version 1', () => {
    const malformed = { version: 1, pose: null } as unknown as PlayerCalibration

    const resolved = resolvePoseMotionConfig(malformed, STANDARD)

    expect(resolved.source).toBe('STANDARD')
    expect(resolved.config).toEqual(POSE_MOTION_CONFIG)
  })
})

describe('resolvePoseMotionConfig bounded adaptation', () => {
  it('preserves asymmetric MOVE and LEAN capability', () => {
    const resolved = resolvePoseMotionConfig(calibration(), STANDARD)

    expect(resolved.source).toBe('CALIBRATION_V1')
    expect(resolved.config.move.left).toEqual({
      enterBodyUnits: 0.14,
      exitBodyUnits: 0.08,
      fullIntensityBodyUnits: 0.3,
    })
    expect(resolved.config.move.right.enterBodyUnits).toBeCloseTo(0.1925)
    expect(resolved.config.move.right.fullIntensityBodyUnits).toBeCloseTo(0.495)
    expect(resolved.config.lean.left).toEqual({
      enterBodyUnits: 0.12,
      exitBodyUnits: 0.07,
      fullIntensityBodyUnits: 0.24,
    })
    expect(resolved.config.lean.right.fullIntensityBodyUnits).toBeCloseTo(0.45)
  })

  it('adapts REACH normalization while preserving intentional-action gates', () => {
    const resolved = resolvePoseMotionConfig(calibration(), STANDARD)

    expect(resolved.config.reach.left.fullExtensionRatio).toBe(0.9)
    expect(resolved.config.reach.right.fullExtensionRatio).toBe(0.98)
    expect(resolved.config.reach.minimumElbowAngleDegrees).toBe(150)
    expect(resolved.config.reach.minimumOutsideBodyUnits).toBe(0.55)
    expect(resolved.config.reach.enterScore).toBe(0.68)
    expect(resolved.config.reach.exitScore).toBe(0.5)
  })

  it('maps a comfortable shallow squat through bounded depth thresholds', () => {
    const resolved = resolvePoseMotionConfig(calibration({ squat: 0.22 }), STANDARD)

    expect(resolved.config.squat).toEqual({
      enterDepthBodyUnits: 0.18,
      exitDepthBodyUnits: 0.1,
      fullDepthBodyUnits: 0.22,
      maximumEnterKneeAngleDegrees: 155,
    })
    expect(resolved.config.jump).toEqual(POSE_MOTION_CONFIG.jump)
  })

  it('enforces exit < enter <= full invariants for extreme valid measurements', () => {
    const resolved = resolvePoseMotionConfig(
      calibration({
        moveLeft: 1.5,
        moveRight: 0.16,
        leanLeft: 1.2,
        leanRight: 0.15,
        squat: 1.2,
      }),
      STANDARD,
    )
    const ranges = [
      resolved.config.move.left,
      resolved.config.move.right,
      resolved.config.lean.left,
      resolved.config.lean.right,
    ]

    for (const range of ranges) {
      expect(range.exitBodyUnits).toBeGreaterThanOrEqual(0)
      expect(range.exitBodyUnits).toBeLessThan(range.enterBodyUnits)
      expect(range.enterBodyUnits).toBeLessThanOrEqual(range.fullIntensityBodyUnits)
    }
    expect(resolved.config.squat.exitDepthBodyUnits).toBeLessThan(
      resolved.config.squat.enterDepthBodyUnits,
    )
    expect(resolved.config.squat.enterDepthBodyUnits).toBeLessThanOrEqual(
      resolved.config.squat.fullDepthBodyUnits,
    )
    expect(resolved.config.move.left.enterBodyUnits).toBe(
      POSE_CALIBRATION_ADAPTATION_LIMITS.move.maximumEnterBodyUnits,
    )
    expect(Object.isFrozen(resolved.config)).toBe(true)
  })

  it('applies ability range scaling after calibration and then reclamps safely', () => {
    const lowMotion = resolveAbilityProfile(['LOW_MOTION'])

    const resolved = resolvePoseMotionConfig(calibration(), lowMotion)

    expect(resolved.config.move.left.enterBodyUnits).toBe(
      POSE_CALIBRATION_ADAPTATION_LIMITS.move.minimumEnterBodyUnits,
    )
    expect(resolved.config.move.left.fullIntensityBodyUnits).toBe(
      POSE_CALIBRATION_ADAPTATION_LIMITS.move.minimumFullIntensityBodyUnits,
    )
    expect(resolved.config.jump).toEqual(POSE_MOTION_CONFIG.jump)
  })

  it('falls back independently for skipped partial-calibration actions', () => {
    const resolved = resolvePoseMotionConfig(
      calibration({ skipped: ['LEAN', 'SQUAT'] }),
      STANDARD,
    )

    expect(resolved.adapted).toEqual({
      move: { left: true, right: true },
      lean: { left: false, right: false },
      reach: { left: true, right: true },
      squat: false,
    })
    expect(resolved.config.lean).toEqual(POSE_MOTION_CONFIG.lean)
    expect(resolved.config.squat).toEqual(POSE_MOTION_CONFIG.squat)
    expect(resolved.config.move).not.toEqual(POSE_MOTION_CONFIG.move)
  })
})
