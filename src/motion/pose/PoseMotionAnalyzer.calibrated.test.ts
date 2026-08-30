import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import { resolvePoseMotionConfig } from '../calibration/calibrationAdaptation'
import type { MotionActionId, PlayerCalibration } from '../contracts/motion'
import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { PoseMotionAnalyzer } from './PoseMotionAnalyzer'
import {
  createSyntheticPoseFrame,
  withPoseTranslation,
} from './syntheticPoseFixtures'

function calibration(): Extract<PlayerCalibration, { readonly version: 1 }> {
  return {
    version: 1,
    status: 'COMPLETE',
    pose: {
      move: { leftRangeBodyUnits: 0.3, rightRangeBodyUnits: 0.6 },
      lean: { leftRangeBodyUnits: 0.25, rightRangeBodyUnits: 0.5 },
      reach: { leftCapability: 0.966, rightCapability: 1 },
      squat: { comfortableDepthBodyUnits: 0.22 },
    },
    steps: {
      NEUTRAL: 'COMPLETE',
      MOVE: 'COMPLETE',
      LEAN: 'COMPLETE',
      REACH: 'COMPLETE',
      SQUAT: 'COMPLETE',
    },
    quality: {
      meanTrackingConfidence: 0.95,
      validSampleCount: 40,
      completedAtTimestampMs: 5_000,
    },
  }
}

function analyzer(calibrated: boolean): PoseMotionAnalyzer {
  if (!calibrated) return new PoseMotionAnalyzer()
  const resolved = resolvePoseMotionConfig(
    calibration(),
    resolveAbilityProfile(['STANDARD']),
  )
  return new PoseMotionAnalyzer(resolved.config)
}

function establishBaseline(target: PoseMotionAnalyzer): void {
  for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
    target.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
  }
  expect(target.getSnapshot(900).baselineReady).toBe(true)
}

function action(target: PoseMotionAnalyzer, id: MotionActionId, nowMs: number): number {
  const value = target.getSnapshot(nowMs).actions[id]?.value
  return typeof value === 'number' ? value : 0
}

function ingestRepeated(
  target: PoseMotionAnalyzer,
  build: (timestampMs: number) => PoseSensorFrame,
  startMs = 1_000,
): number {
  for (const timestampMs of [startMs, startMs + 50, startMs + 100]) {
    target.ingest(build(timestampMs))
  }
  return startMs + 100
}

function translated(timestampMs: number, ownLeft: boolean): PoseSensorFrame {
  return withPoseTranslation(
    createSyntheticPoseFrame('neutral', { timestampMs }),
    ownLeft ? 0.042 : -0.042,
    0,
  )
}

function leanFrame(timestampMs: number, ownLeft: boolean): PoseSensorFrame {
  const frame = createSyntheticPoseFrame('neutral', { timestampMs })
  const pose = frame.poses[0]
  if (!pose) return frame
  const deltaX = ownLeft ? 0.031 : -0.031
  return {
    ...frame,
    poses: [{
      ...pose,
      landmarks: pose.landmarks.map((point, index) =>
        index === 11 || index === 12 ? { ...point, x: point.x + deltaX } : point,
      ),
    }],
  }
}

function reducedLeftReach(timestampMs: number, elbowIntent = true): PoseSensorFrame {
  const frame = createSyntheticPoseFrame('neutral', { timestampMs })
  const pose = frame.poses[0]
  if (!pose) return frame
  return {
    ...frame,
    poses: [{
      ...pose,
      landmarks: pose.landmarks.map((point, index) => {
        if (index === 13) return { ...point, x: 0.6094, y: elbowIntent ? 0.3 : 0.37 }
        if (index === 15) return { ...point, x: 0.6435, y: 0.335 }
        return point
      }),
    }],
  }
}

function shallowSquat(timestampMs: number, depthBodyUnits: number): PoseSensorFrame {
  const frame = createSyntheticPoseFrame('squat', { timestampMs })
  const pose = frame.poses[0]
  if (!pose) return frame
  const hipY = 0.52 + depthBodyUnits * 0.2488888889
  return {
    ...frame,
    poses: [{
      ...pose,
      landmarks: pose.landmarks.map((point, index) =>
        index === 23 || index === 24 ? { ...point, y: hipY } : point,
      ),
    }],
  }
}

describe('calibrated PoseMotionAnalyzer directional normalization', () => {
  it('maps the smaller calibrated MOVE side to stronger output independently', () => {
    const left = analyzer(true)
    const right = analyzer(true)
    establishBaseline(left)
    establishBaseline(right)

    const leftNow = ingestRepeated(left, (timestampMs) => translated(timestampMs, true))
    const rightNow = ingestRepeated(right, (timestampMs) => translated(timestampMs, false))

    expect(action(left, 'MOVE_LEFT', leftNow)).toBeGreaterThan(0.85)
    expect(action(right, 'MOVE_RIGHT', rightNow)).toBeLessThan(0.6)
  })

  it('keeps natural MOVE jitter below the calibrated safety floor neutral', () => {
    const target = analyzer(true)
    establishBaseline(target)

    const now = ingestRepeated(target, (timestampMs) =>
      withPoseTranslation(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        0.01,
        0,
      ),
    )

    expect(action(target, 'MOVE_LEFT', now)).toBe(0)
    expect(action(target, 'MOVE_RIGHT', now)).toBe(0)
  })

  it('maps the smaller calibrated LEAN side to stronger output independently', () => {
    const left = analyzer(true)
    const right = analyzer(true)
    establishBaseline(left)
    establishBaseline(right)

    const leftNow = ingestRepeated(left, (timestampMs) => leanFrame(timestampMs, true))
    const rightNow = ingestRepeated(right, (timestampMs) => leanFrame(timestampMs, false))

    expect(action(left, 'LEAN_LEFT', leftNow)).toBeGreaterThan(0.85)
    expect(action(right, 'LEAN_RIGHT', rightNow)).toBeLessThan(0.6)
  })

  it('normalizes reduced anatomical reach without removing the elbow intent gate', () => {
    const standard = analyzer(false)
    const calibrated = analyzer(true)
    const gated = analyzer(true)
    establishBaseline(standard)
    establishBaseline(calibrated)
    establishBaseline(gated)

    const standardNow = ingestRepeated(standard, (timestampMs) => reducedLeftReach(timestampMs))
    const calibratedNow = ingestRepeated(calibrated, (timestampMs) => reducedLeftReach(timestampMs))
    const gatedNow = ingestRepeated(gated, (timestampMs) => reducedLeftReach(timestampMs, false))

    expect(action(standard, 'REACH_LEFT', standardNow)).toBeLessThan(0.9)
    expect(action(calibrated, 'REACH_LEFT', calibratedNow)).toBeGreaterThan(0.95)
    expect(action(gated, 'REACH_LEFT', gatedNow)).toBe(0)
    expect(action(calibrated, 'REACH_RIGHT', calibratedNow)).toBe(0)
  })
})

describe('calibrated PoseMotionAnalyzer SQUAT and JUMP safety', () => {
  it('lets comfortable shallow calibrated SQUAT activate while STANDARD stays neutral', () => {
    const standard = analyzer(false)
    const calibrated = analyzer(true)
    establishBaseline(standard)
    establishBaseline(calibrated)

    const standardNow = ingestRepeated(standard, (timestampMs) => shallowSquat(timestampMs, 0.22))
    const calibratedNow = ingestRepeated(calibrated, (timestampMs) => shallowSquat(timestampMs, 0.22))

    expect(action(standard, 'SQUAT', standardNow)).toBe(0)
    expect(action(calibrated, 'SQUAT', calibratedNow)).toBeGreaterThan(0.9)
  })

  it('does not trigger calibrated SQUAT from a tiny bend', () => {
    const target = analyzer(true)
    establishBaseline(target)

    const now = ingestRepeated(target, (timestampMs) => shallowSquat(timestampMs, 0.12))

    expect(action(target, 'SQUAT', now)).toBe(0)
  })

  it('preserves the SQUAT knee-angle intent gate', () => {
    const target = analyzer(true)
    establishBaseline(target)

    const now = ingestRepeated(target, (timestampMs) =>
      withPoseTranslation(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        0,
        0.055,
      ),
    )

    expect(action(target, 'SQUAT', now)).toBe(0)
  })

  it('does not emit JUMP during calibrated squat-to-stand recovery', () => {
    const target = analyzer(true)
    establishBaseline(target)
    ingestRepeated(target, (timestampMs) => shallowSquat(timestampMs, 0.22))

    target.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_200 }))
    target.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_250 }))

    expect(action(target, 'JUMP', 1_250)).toBe(0)
    expect(target.getSnapshot(1_250).jumpState).toBe('GROUNDED')
  })
})
