import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import { resolvePoseMotionConfig } from '../calibration/calibrationAdaptation'
import type { MotionActionId } from '../contracts/motion'
import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { PoseMotionAnalyzer } from './PoseMotionAnalyzer'
import {
  createSyntheticPoseFrame,
  withPoseTranslation,
} from './syntheticPoseFixtures'

type FunctionalProfile = 'STANDARD' | 'LOW_MOTION' | 'SLOW_RESPONSE'

function analyzer(profiles: readonly FunctionalProfile[]): PoseMotionAnalyzer {
  const resolved = resolvePoseMotionConfig(
    undefined,
    resolveAbilityProfile(profiles),
  )
  return new PoseMotionAnalyzer({
    ...resolved.config,
    smoothingAlpha: 1,
  })
}

function establishBaseline(target: PoseMotionAnalyzer): void {
  for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
    target.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
  }
  expect(target.getSnapshot(900).baselineReady).toBe(true)
}

function action(
  target: PoseMotionAnalyzer,
  actionId: MotionActionId,
  timestampMs: number,
): number {
  const value = target.getSnapshot(timestampMs).actions[actionId]?.value
  return typeof value === 'number' ? value : 0
}

function translatedMove(
  timestampMs: number,
  ownLeft: boolean,
  delta = 0.026,
): PoseSensorFrame {
  return withPoseTranslation(
    createSyntheticPoseFrame('neutral', { timestampMs }),
    ownLeft ? delta : -delta,
    0,
  )
}

function shallowSquat(
  timestampMs: number,
  depthBodyUnits: number,
): PoseSensorFrame {
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

function leanLeft(timestampMs: number): PoseSensorFrame {
  const frame = createSyntheticPoseFrame('neutral', { timestampMs })
  const pose = frame.poses[0]
  if (!pose) return frame
  return {
    ...frame,
    poses: [{
      ...pose,
      landmarks: pose.landmarks.map((point, index) =>
        index === 11 || index === 12
          ? { ...point, x: point.x + 0.04 }
          : point,
      ),
    }],
  }
}

function ingestRepeated(
  target: PoseMotionAnalyzer,
  build: (timestampMs: number) => PoseSensorFrame,
): number {
  for (const timestampMs of [1_000, 1_050, 1_100]) {
    target.ingest(build(timestampMs))
  }
  return 1_100
}

function ingestInterruptedMove(
  target: PoseMotionAnalyzer,
  neutralTimestamps: readonly number[],
  delta = 0.04,
): number {
  target.ingest(translatedMove(1_000, true, delta))
  for (const timestampMs of neutralTimestamps) {
    target.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
  }
  target.ingest(translatedMove(1_230, true, delta))
  return 1_230
}

describe('LOW_MOTION analyzer behavior', () => {
  it('activates intentional smaller MOVE in either canonical direction', () => {
    const standardLeft = analyzer(['STANDARD'])
    const lowLeft = analyzer(['LOW_MOTION'])
    const lowRight = analyzer(['LOW_MOTION'])
    establishBaseline(standardLeft)
    establishBaseline(lowLeft)
    establishBaseline(lowRight)

    const standardNow = ingestRepeated(standardLeft, (timestampMs) =>
      translatedMove(timestampMs, true),
    )
    const lowLeftNow = ingestRepeated(lowLeft, (timestampMs) =>
      translatedMove(timestampMs, true),
    )
    const lowRightNow = ingestRepeated(lowRight, (timestampMs) =>
      translatedMove(timestampMs, false),
    )

    expect(action(standardLeft, 'MOVE_LEFT', standardNow)).toBe(0)
    expect(action(lowLeft, 'MOVE_LEFT', lowLeftNow)).toBeGreaterThan(0)
    expect(action(lowLeft, 'MOVE_RIGHT', lowLeftNow)).toBe(0)
    expect(action(lowRight, 'MOVE_RIGHT', lowRightNow)).toBeGreaterThan(0)
    expect(action(lowRight, 'MOVE_LEFT', lowRightNow)).toBe(0)
  })

  it('keeps natural jitter and relaxed arms neutral', () => {
    const target = analyzer(['LOW_MOTION'])
    establishBaseline(target)

    const now = ingestRepeated(target, (timestampMs) =>
      translatedMove(timestampMs, true, 0.01),
    )

    expect(action(target, 'MOVE_LEFT', now)).toBe(0)
    expect(action(target, 'MOVE_RIGHT', now)).toBe(0)
    expect(action(target, 'REACH_LEFT', now)).toBe(0)
    expect(action(target, 'REACH_RIGHT', now)).toBe(0)
  })

  it('allows bounded shallower SQUAT but rejects tiny bends and preserves JUMP', () => {
    const standard = analyzer(['STANDARD'])
    const low = analyzer(['LOW_MOTION'])
    const tiny = analyzer(['LOW_MOTION'])
    establishBaseline(standard)
    establishBaseline(low)
    establishBaseline(tiny)

    const standardNow = ingestRepeated(standard, (timestampMs) =>
      shallowSquat(timestampMs, 0.2),
    )
    const lowNow = ingestRepeated(low, (timestampMs) =>
      shallowSquat(timestampMs, 0.2),
    )
    const tinyNow = ingestRepeated(tiny, (timestampMs) =>
      shallowSquat(timestampMs, 0.12),
    )

    expect(action(standard, 'SQUAT', standardNow)).toBe(0)
    expect(action(low, 'SQUAT', lowNow)).toBeGreaterThan(0)
    expect(action(tiny, 'SQUAT', tinyNow)).toBe(0)
    expect(action(low, 'JUMP', lowNow)).toBe(0)
  })
})

describe('SLOW_RESPONSE timestamp behavior', () => {
  it('retains a deliberate candidate across a short stabilization gap', () => {
    const standard = analyzer(['STANDARD'])
    const slow = analyzer(['SLOW_RESPONSE'])
    establishBaseline(standard)
    establishBaseline(slow)

    const standardNow = ingestInterruptedMove(standard, [1_083, 1_166])
    const slowNow = ingestInterruptedMove(slow, [1_083, 1_166])

    expect(action(standard, 'MOVE_LEFT', standardNow)).toBe(0)
    expect(action(slow, 'MOVE_LEFT', slowNow)).toBeGreaterThan(0)
  })

  it.each([
    ['12 Hz', [1_083, 1_166]],
    ['20 Hz', [1_050, 1_100, 1_150, 1_200]],
  ] as const)('uses the same millisecond window at %s', (_label, gaps) => {
    const slow = analyzer(['SLOW_RESPONSE'])
    establishBaseline(slow)

    const now = ingestInterruptedMove(slow, gaps)

    expect(action(slow, 'MOVE_LEFT', now)).toBeGreaterThan(0)
  })

  it('does not lower range or retain isolated noise beyond the grace window', () => {
    const slowRange = analyzer(['SLOW_RESPONSE'])
    const slowNoise = analyzer(['SLOW_RESPONSE'])
    establishBaseline(slowRange)
    establishBaseline(slowNoise)

    const rangeNow = ingestRepeated(slowRange, (timestampMs) =>
      translatedMove(timestampMs, true, 0.02),
    )
    slowNoise.ingest(translatedMove(1_000, true, 0.04))
    slowNoise.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_250 }))
    slowNoise.ingest(translatedMove(1_350, true, 0.04))

    expect(action(slowRange, 'MOVE_LEFT', rangeNow)).toBe(0)
    expect(action(slowNoise, 'MOVE_LEFT', 1_350)).toBe(0)
  })

  it('applies the same stabilization grace to LEAN, REACH, and SQUAT candidates', () => {
    const lean = analyzer(['SLOW_RESPONSE'])
    const reach = analyzer(['SLOW_RESPONSE'])
    const squat = analyzer(['SLOW_RESPONSE'])
    establishBaseline(lean)
    establishBaseline(reach)
    establishBaseline(squat)

    lean.ingest(leanLeft(1_000))
    reach.ingest(createSyntheticPoseFrame('reach-left', { timestampMs: 1_000 }))
    squat.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_000 }))
    for (const timestampMs of [1_083, 1_166]) {
      const neutral = createSyntheticPoseFrame('neutral', { timestampMs })
      lean.ingest(neutral)
      reach.ingest(neutral)
      squat.ingest(neutral)
    }
    lean.ingest(leanLeft(1_230))
    reach.ingest(createSyntheticPoseFrame('reach-left', { timestampMs: 1_230 }))
    squat.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_230 }))

    expect(action(lean, 'LEAN_LEFT', 1_230)).toBeGreaterThan(0)
    expect(action(reach, 'REACH_LEFT', 1_230)).toBeGreaterThan(0)
    expect(action(squat, 'SQUAT', 1_230)).toBeGreaterThan(0)
  })
})

describe('combined functional profiles', () => {
  it('combines lower bounded range with longer timing without changing JUMP', () => {
    const lowOnly = analyzer(['LOW_MOTION'])
    const combined = analyzer(['LOW_MOTION', 'SLOW_RESPONSE'])
    establishBaseline(lowOnly)
    establishBaseline(combined)

    const lowNow = ingestInterruptedMove(lowOnly, [1_083, 1_166], 0.026)
    const combinedNow = ingestInterruptedMove(combined, [1_083, 1_166], 0.026)

    expect(action(lowOnly, 'MOVE_LEFT', lowNow)).toBe(0)
    expect(action(combined, 'MOVE_LEFT', combinedNow)).toBeGreaterThan(0)
    expect(action(combined, 'JUMP', combinedNow)).toBe(0)
  })
})
