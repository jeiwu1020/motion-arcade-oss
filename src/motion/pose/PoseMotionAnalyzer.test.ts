import { describe, expect, it } from 'vitest'

import type { MotionActionId } from '../contracts/motion'
import { PoseMotionAnalyzer } from './PoseMotionAnalyzer'
import { POSE_MOTION_CONFIG } from './poseMotionConfig'
import {
  createSyntheticPoseFrame,
  withLandmarkConfidence,
  withPoseTranslation,
} from './syntheticPoseFixtures'

function establishBaseline(analyzer: PoseMotionAnalyzer): number {
  for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
  }
  expect(analyzer.getSnapshot(900).baselineReady).toBe(true)
  return 900
}

function numericAction(
  analyzer: PoseMotionAnalyzer,
  actionId: MotionActionId,
  nowMs: number,
): number {
  const value = analyzer.getSnapshot(nowMs).actions[actionId]?.value
  return typeof value === 'number' ? value : 0
}

describe('PoseMotionAnalyzer baseline and quality', () => {
  it('keeps readiness safety constants unchanged', () => {
    expect(POSE_MOTION_CONFIG.minimumLandmarkConfidence).toBe(0.55)
    expect(POSE_MOTION_CONFIG.staleAfterMs).toBe(250)
    expect(POSE_MOTION_CONFIG.resetBaselineAfterLossMs).toBe(1_200)
    expect(POSE_MOTION_CONFIG.baselineDurationMs).toBe(800)
    expect(POSE_MOTION_CONFIG.baselineMinimumSamples).toBe(8)
    expect(POSE_MOTION_CONFIG.fullBodyBaselineGapGraceMs).toBe(350)
  })

  it('keeps every action neutral while the temporary baseline is collecting', () => {
    const analyzer = new PoseMotionAnalyzer()
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 0 }))

    const snapshot = analyzer.getSnapshot(0)
    expect(snapshot.quality).toBe('BASELINING')
    expect(snapshot.baselineReady).toBe(false)
    expect(Object.values(snapshot.actions).every((action) => action?.value === 0)).toBe(true)
  })

  it('establishes a session-local baseline from stable valid frames', () => {
    const analyzer = new PoseMotionAnalyzer()

    establishBaseline(analyzer)

    expect(analyzer.getSnapshot(900).quality).toBe('READY')
    expect(analyzer.getSnapshot(900).baselineProgress).toBe(1)
  })

  it('does not establish the standing baseline without valid lower-body landmarks', () => {
    const analyzer = new PoseMotionAnalyzer()
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      const frame = withLandmarkConfidence(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        27,
        0.1,
      )
      analyzer.ingest(frame)
    }

    expect(analyzer.getSnapshot(900).baselineReady).toBe(false)
    expect(analyzer.getSnapshot(900).quality).toBe('LIMITED')
  })

  it('allows an explicit knees-only full-body baseline without fabricating ankle data', () => {
    const analyzer = new PoseMotionAnalyzer({ lowerBodyReadiness: 'KNEES' })
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      let frame = withLandmarkConfidence(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        27,
        0.1,
      )
      frame = withLandmarkConfidence(frame, 28, 0.1)
      analyzer.ingest(frame)
    }

    expect(analyzer.getSnapshot(900)).toMatchObject({
      baselineReady: true,
      fullBodyReady: true,
      quality: 'READY',
    })
    expect(analyzer.getSnapshot(900).actions.JUMP?.value).toBe(0)
  })

  it('still blocks knees-only compact readiness when either required knee is missing', () => {
    const analyzer = new PoseMotionAnalyzer({ lowerBodyReadiness: 'KNEES' })
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      analyzer.ingest(withLandmarkConfidence(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        25,
        0.1,
      ))
    }

    expect(analyzer.getSnapshot(900)).toMatchObject({
      baselineReady: false,
      fullBodyReady: false,
      quality: 'LIMITED',
    })
  })

  it('preserves full-body baseline progress across a brief lower-body dropout', () => {
    const analyzer = new PoseMotionAnalyzer()
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 0 }))
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 100 }))
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 200 }))
    const invalid = withLandmarkConfidence(
      createSyntheticPoseFrame('neutral', { timestampMs: 300 }),
      27,
      0.1,
    )
    analyzer.ingest(invalid)

    const duringGap = analyzer.getSnapshot(300)
    expect(duringGap.baselineProgress).toBeGreaterThan(0)
    expect(duringGap.baselineReady).toBe(false)

    for (let timestampMs = 400; timestampMs <= 900; timestampMs += 100) {
      analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
    }
    expect(analyzer.getSnapshot(900).baselineReady).toBe(true)
  })

  it('resets full-body baseline acquisition after a dropout beyond the grace window', () => {
    const analyzer = new PoseMotionAnalyzer()
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 0 }))
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 100 }))
    analyzer.ingest(
      withLandmarkConfidence(
        createSyntheticPoseFrame('neutral', { timestampMs: 500 }),
        27,
        0.1,
      ),
    )

    expect(analyzer.getSnapshot(500).baselineProgress).toBe(0)
    expect(analyzer.getSnapshot(500).baselineReady).toBe(false)
  })

  it('clears the baseline and transient state on reset', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)

    analyzer.reset()

    expect(analyzer.getSnapshot(901).baselineReady).toBe(false)
    expect(analyzer.getSnapshot(901).quality).toBe('LOST')
  })

  it('neutralizes immediately when pose tracking is lost', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_050 }))
    expect(numericAction(analyzer, 'MOVE_LEFT', 1_050)).toBeGreaterThan(0)

    analyzer.ingest(
      createSyntheticPoseFrame('neutral', {
        timestampMs: 1_100,
        missingPose: true,
      }),
    )

    expect(numericAction(analyzer, 'MOVE_LEFT', 1_100)).toBe(0)
    expect(analyzer.getSnapshot(1_100).quality).toBe('LOST')
  })

  it('expires active actions without requiring another pose frame', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('move-right', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('move-right', { timestampMs: 1_050 }))
    expect(numericAction(analyzer, 'MOVE_RIGHT', 1_050)).toBeGreaterThan(0)

    const stale = analyzer.getSnapshot(1_301)

    expect(stale.quality).toBe('LOST')
    expect(stale.actions.MOVE_RIGHT?.value).toBe(0)
  })

  it('requires a fresh baseline after long tracking loss', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)

    analyzer.getSnapshot(2_201)
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 2_300 }))

    expect(analyzer.getSnapshot(2_300).baselineReady).toBe(false)
    expect(analyzer.getSnapshot(2_300).quality).toBe('BASELINING')
  })
})

describe('PoseMotionAnalyzer MOVE and LEAN', () => {
  it('keeps the neutral center inside the MOVE dead zone', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_000 }))

    expect(numericAction(analyzer, 'MOVE_LEFT', 1_000)).toBe(0)
    expect(numericAction(analyzer, 'MOVE_RIGHT', 1_000)).toBe(0)
  })

  it('maps raw lateral displacement through mirrored world coordinates', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_050 }))
    const left = numericAction(analyzer, 'MOVE_LEFT', 1_050)

    analyzer.ingest(createSyntheticPoseFrame('move-right', { timestampMs: 1_100 }))
    analyzer.ingest(createSyntheticPoseFrame('move-right', { timestampMs: 1_150 }))
    const right = numericAction(analyzer, 'MOVE_RIGHT', 1_150)

    expect(left).toBeGreaterThan(0)
    expect(right).toBeGreaterThan(0)
    expect(left).toBeLessThanOrEqual(1)
    expect(right).toBeLessThanOrEqual(1)
  })

  it('holds MOVE through the hysteresis band and exits below it', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_050 }))

    const inBand = withPoseTranslation(
      createSyntheticPoseFrame('neutral', { timestampMs: 1_100 }),
      0.025,
      0,
    )
    analyzer.ingest(inBand)
    expect(numericAction(analyzer, 'MOVE_LEFT', 1_100)).toBeGreaterThan(0)

    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_150 }))
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_200 }))
    expect(numericAction(analyzer, 'MOVE_LEFT', 1_200)).toBe(0)
  })

  it('detects left and right torso lean independently', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('lean-left', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('lean-left', { timestampMs: 1_050 }))
    expect(numericAction(analyzer, 'LEAN_LEFT', 1_050)).toBeGreaterThan(0)

    analyzer.ingest(createSyntheticPoseFrame('lean-right', { timestampMs: 1_100 }))
    analyzer.ingest(createSyntheticPoseFrame('lean-right', { timestampMs: 1_150 }))
    expect(numericAction(analyzer, 'LEAN_RIGHT', 1_150)).toBeGreaterThan(0)
  })

  it('does not turn pure lateral translation into torso lean', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_050 }))

    expect(numericAction(analyzer, 'LEAN_LEFT', 1_050)).toBe(0)
    expect(numericAction(analyzer, 'LEAN_RIGHT', 1_050)).toBe(0)
  })
})

describe('PoseMotionAnalyzer REACH and SQUAT', () => {
  it('keeps naturally hanging arms neutral', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_000 }))

    expect(numericAction(analyzer, 'REACH_LEFT', 1_000)).toBe(0)
    expect(numericAction(analyzer, 'REACH_RIGHT', 1_000)).toBe(0)
  })

  it('preserves anatomical left and right reach actions', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('reach-left', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('reach-left', { timestampMs: 1_050 }))
    expect(numericAction(analyzer, 'REACH_LEFT', 1_050)).toBeGreaterThan(0)
    expect(numericAction(analyzer, 'REACH_RIGHT', 1_050)).toBe(0)

    analyzer.ingest(createSyntheticPoseFrame('reach-right', { timestampMs: 1_100 }))
    analyzer.ingest(createSyntheticPoseFrame('reach-right', { timestampMs: 1_150 }))
    expect(numericAction(analyzer, 'REACH_RIGHT', 1_150)).toBeGreaterThan(0)
  })

  it('does not hallucinate a reach from a low-confidence wrist', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    const lowConfidence = withLandmarkConfidence(
      createSyntheticPoseFrame('reach-left', { timestampMs: 1_000 }),
      15,
      0.1,
    )
    analyzer.ingest(lowConfidence)
    analyzer.ingest({ ...lowConfidence, timestampMs: 1_050 })

    expect(numericAction(analyzer, 'REACH_LEFT', 1_050)).toBe(0)
  })

  it('activates squat from pelvis drop plus knee flexion', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_000 }))
    expect(analyzer.getSnapshot(1_000).squatState).toBe('DESCENDING')
    expect(numericAction(analyzer, 'SQUAT', 1_000)).toBe(0)
    analyzer.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_050 }))

    const snapshot = analyzer.getSnapshot(1_050)
    expect(snapshot.squatState).toBe('SQUAT')
    expect(snapshot.actions.SQUAT?.value).toBeGreaterThan(0)
    expect(snapshot.actions.SQUAT?.value).toBeLessThanOrEqual(1)
  })

  it('uses exit hysteresis so jitter does not repeatedly toggle squat', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_050 }))
    const shallow = withPoseTranslation(
      createSyntheticPoseFrame('neutral', { timestampMs: 1_100 }),
      0,
      0.045,
    )
    analyzer.ingest(shallow)
    expect(numericAction(analyzer, 'SQUAT', 1_100)).toBeGreaterThan(0)

    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_150 }))
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_200 }))
    expect(numericAction(analyzer, 'SQUAT', 1_200)).toBe(0)
  })

  it('lets explicit knees-only compact tracking recognize deliberate hip descent without ankles', () => {
    const analyzer = new PoseMotionAnalyzer({
      lowerBodyReadiness: 'KNEES',
      squat: {
        enterDepthBodyUnits: 0.18,
        exitDepthBodyUnits: 0.1,
        fullDepthBodyUnits: 0.39,
        maximumEnterKneeAngleDegrees: 155,
      },
    })
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      let frame = withLandmarkConfidence(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        27,
        0.1,
      )
      frame = withLandmarkConfidence(frame, 28, 0.1)
      analyzer.ingest(frame)
    }
    let squat = withLandmarkConfidence(
      createSyntheticPoseFrame('squat', { timestampMs: 1_000 }),
      27,
      0.1,
    )
    squat = withLandmarkConfidence(squat, 28, 0.1)
    analyzer.ingest(squat)
    analyzer.ingest({ ...squat, timestampMs: 1_050 })

    expect(numericAction(analyzer, 'SQUAT', 1_050)).toBeGreaterThan(0)
  })
})

describe('PoseMotionAnalyzer JUMP temporal state machine', () => {
  it('does not emit jump while standing or squatting', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_050 }))
    analyzer.ingest(createSyntheticPoseFrame('squat', { timestampMs: 1_100 }))

    expect(numericAction(analyzer, 'JUMP', 1_100)).toBe(0)
  })

  it('emits exactly one pulse for a valid takeoff sequence', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 950 }))
    analyzer.ingest(createSyntheticPoseFrame('jump-takeoff', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('jump-airborne', { timestampMs: 1_050 }))
    const emitted = analyzer.getSnapshot(1_050)

    analyzer.ingest(createSyntheticPoseFrame('jump-airborne', { timestampMs: 1_100 }))
    const held = analyzer.getSnapshot(1_100)

    expect(emitted.actions.JUMP?.phase).toBe('started')
    expect(emitted.actions.JUMP?.value).toBe(1)
    expect(held.actions.JUMP?.value).toBe(0)
    expect(held.jumpState).toBe('AIRBORNE')
  })

  it('requires landing and refractory completion before another jump', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 950 }))
    analyzer.ingest(createSyntheticPoseFrame('jump-takeoff', { timestampMs: 1_000 }))
    analyzer.ingest(createSyntheticPoseFrame('jump-airborne', { timestampMs: 1_050 }))
    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_150 }))
    expect(analyzer.getSnapshot(1_150).jumpState).toBe('LANDING')
    analyzer.ingest(createSyntheticPoseFrame('jump-takeoff', { timestampMs: 1_200 }))
    analyzer.ingest(createSyntheticPoseFrame('jump-airborne', { timestampMs: 1_250 }))
    expect(numericAction(analyzer, 'JUMP', 1_250)).toBe(0)

    analyzer.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 1_800 }))
    analyzer.ingest(createSyntheticPoseFrame('jump-takeoff', { timestampMs: 1_850 }))
    analyzer.ingest(createSyntheticPoseFrame('jump-airborne', { timestampMs: 1_900 }))
    expect(numericAction(analyzer, 'JUMP', 1_900)).toBe(1)
  })

  it('resets jump state safely when tracking becomes stale', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    analyzer.ingest(createSyntheticPoseFrame('jump-takeoff', { timestampMs: 1_000 }))

    const stale = analyzer.getSnapshot(1_301)

    expect(stale.actions.JUMP?.value).toBe(0)
    expect(stale.jumpState).toBe('GROUNDED')
  })
})

describe('PoseMotionAnalyzer mirroring', () => {
  it('never mutates raw landmarks while producing mirrored game-world MOVE', () => {
    const analyzer = new PoseMotionAnalyzer()
    establishBaseline(analyzer)
    const frame = createSyntheticPoseFrame('move-left', { timestampMs: 1_000 })
    const before = structuredClone(frame)

    analyzer.ingest(frame)

    expect(frame).toEqual(before)
  })
})
