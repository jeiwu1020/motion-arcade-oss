import { describe, expect, it } from 'vitest'

import { PoseFeatureExtractor } from './PoseFeatureExtractor'
import {
  createSyntheticPoseFrame,
  withLandmarkConfidence,
} from './syntheticPoseFixtures'

describe('PoseFeatureExtractor', () => {
  it('extracts hand-checked shoulder, hip, and body centers', () => {
    const features = new PoseFeatureExtractor().extract(
      createSyntheticPoseFrame('neutral'),
    )

    expect(features.shoulderMidpoint).toMatchObject({ x: 0.5, y: 0.3 })
    expect(features.hipMidpoint).toMatchObject({ x: 0.5, y: 0.52 })
    expect(features.bodyCenter.x).toBeCloseTo(0.5)
    expect(features.bodyCenter.y).toBeCloseTo(0.41)
  })

  it('uses aspect-corrected torso length as a body-relative scale', () => {
    const features = new PoseFeatureExtractor().extract(
      createSyntheticPoseFrame('neutral'),
    )

    expect(features.torsoLength).toBeCloseTo(0.22, 5)
    expect(features.bodyScale).toBeGreaterThanOrEqual(features.torsoLength)
  })

  it('preserves anatomical left and right landmark identities', () => {
    const features = new PoseFeatureExtractor().extract(
      createSyntheticPoseFrame('reach-left'),
    )

    expect(features.leftWrist.x).toBeCloseTo(0.81)
    expect(features.rightWrist.x).toBeCloseTo(0.39)
    expect(features.leftArm.extensionRatio).toBeGreaterThan(0.95)
  })

  it('extracts knee flexion independently on both anatomical sides', () => {
    const standing = new PoseFeatureExtractor().extract(
      createSyntheticPoseFrame('neutral'),
    )
    const squat = new PoseFeatureExtractor().extract(
      createSyntheticPoseFrame('squat'),
    )

    expect(standing.leftKnee.angleDegrees).toBeGreaterThan(175)
    expect(squat.leftKnee.angleDegrees).toBeLessThan(150)
    expect(squat.rightKnee.angleDegrees).toBeLessThan(150)
  })

  it('marks only features depending on a low-confidence wrist invalid', () => {
    const frame = withLandmarkConfidence(
      createSyntheticPoseFrame('reach-left'),
      15,
      0.2,
    )
    const features = new PoseFeatureExtractor().extract(frame)

    expect(features.coreValid).toBe(true)
    expect(features.leftWrist.valid).toBe(false)
    expect(features.leftArm.valid).toBe(false)
    expect(features.rightArm.valid).toBe(true)
  })

  it('returns an invalid feature frame when no pose exists', () => {
    const features = new PoseFeatureExtractor().extract(
      createSyntheticPoseFrame('neutral', { missingPose: true }),
    )

    expect(features.posePresent).toBe(false)
    expect(features.coreValid).toBe(false)
    expect(features.fullBodyValid).toBe(false)
  })

  it('does not mutate the raw landmark frame', () => {
    const frame = createSyntheticPoseFrame('neutral')
    const before = structuredClone(frame)

    new PoseFeatureExtractor().extract(frame)

    expect(frame).toEqual(before)
  })
})
