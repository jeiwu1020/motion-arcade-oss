import { describe, expect, it } from 'vitest'

import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { PoseFeatureExtractor } from '../pose/PoseFeatureExtractor'
import {
  createSyntheticPoseFrame,
  withLandmarkConfidence,
  withPoseTranslation,
  type SyntheticPoseName,
} from '../pose/syntheticPoseFixtures'
import { PoseCalibrationSession } from './PoseCalibrationSession'

const extractor = new PoseFeatureExtractor()

function ingest(
  session: PoseCalibrationSession,
  name: SyntheticPoseName,
  timestampMs: number,
): void {
  session.ingest(extractor.extract(createSyntheticPoseFrame(name, { timestampMs })))
}

function ingestFrame(session: PoseCalibrationSession, frame: PoseSensorFrame): void {
  session.ingest(extractor.extract(frame))
}

function establishNeutral(session: PoseCalibrationSession): number {
  session.advance()
  for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
    ingest(session, 'neutral', timestampMs)
  }
  expect(session.getSnapshot().step).toBe('NEUTRAL')
  expect(session.getSnapshot().readyToAdvance).toBe(true)
  session.advance()
  return 1_000
}

function captureBoth(
  session: PoseCalibrationSession,
  left: SyntheticPoseName,
  right: SyntheticPoseName,
  startMs: number,
): number {
  ingest(session, left, startMs)
  ingest(session, left, startMs + 50)
  ingest(session, right, startMs + 100)
  ingest(session, right, startMs + 150)
  return startMs + 200
}

function prepareReach(session: PoseCalibrationSession, startMs: number): number {
  ingest(session, 'neutral', startMs)
  ingest(session, 'neutral', startMs + 50)
  expect(session.getSnapshot().reachReadyForMotion).toBe(true)
  expect(session.getSnapshot().sideProgress).toEqual({ left: false, right: false })
  return startMs + 100
}

function completeAllMeasurements(session: PoseCalibrationSession): void {
  let now = establishNeutral(session)
  now = captureBoth(session, 'move-left', 'move-right', now)
  expect(session.getSnapshot().readyToAdvance).toBe(true)
  session.advance()
  now = captureBoth(session, 'lean-left', 'lean-right', now)
  expect(session.getSnapshot().readyToAdvance).toBe(true)
  session.advance()
  now = prepareReach(session, now)
  now = captureBoth(session, 'reach-left', 'reach-right', now)
  expect(session.getSnapshot().readyToAdvance).toBe(true)
  session.advance()
  ingest(session, 'squat', now)
  ingest(session, 'squat', now + 50)
  expect(session.getSnapshot().readyToAdvance).toBe(true)
  session.advance()
}

describe('PoseCalibrationSession neutral baseline', () => {
  it('requires a stable full-body collection window', () => {
    const session = new PoseCalibrationSession()

    session.advance()
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      ingest(session, 'neutral', timestampMs)
    }

    expect(session.getSnapshot()).toMatchObject({
      step: 'NEUTRAL',
      readyToAdvance: true,
      collectionState: 'READY',
    })
  })

  it('does not complete from an unstable stance', () => {
    const session = new PoseCalibrationSession()
    session.advance()

    for (let timestampMs = 0; timestampMs <= 1_200; timestampMs += 100) {
      const frame = withPoseTranslation(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        timestampMs % 200 === 0 ? -0.12 : 0.12,
        0,
      )
      ingestFrame(session, frame)
    }

    expect(session.getSnapshot().readyToAdvance).toBe(false)
  })

  it('rejects neutral frames without valid legs and ankles', () => {
    const session = new PoseCalibrationSession()
    session.advance()

    for (let timestampMs = 0; timestampMs <= 1_000; timestampMs += 100) {
      const invalidAnkle = withLandmarkConfidence(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        27,
        0.1,
      )
      ingestFrame(session, invalidAnkle)
    }

    expect(session.getSnapshot()).toMatchObject({
      readyToAdvance: false,
      collectionState: 'WAITING_FOR_TRACKING',
    })
  })
})

describe('PoseCalibrationSession normalized measurements', () => {
  it('captures canonical own-left and own-right MOVE ranges despite mirrored display', () => {
    const session = new PoseCalibrationSession()
    let now = establishNeutral(session)

    now = captureBoth(session, 'move-left', 'move-right', now)
    expect(now).toBeGreaterThan(0)
    const snapshot = session.getSnapshot()

    expect(snapshot.measurements.move.leftRangeBodyUnits).toBeGreaterThan(0)
    expect(snapshot.measurements.move.rightRangeBodyUnits).toBeGreaterThan(0)
    expect(snapshot.measurements.move.leftRangeBodyUnits).toBeCloseTo(
      snapshot.measurements.move.rightRangeBodyUnits ?? 0,
      5,
    )
    expect(snapshot.sideProgress).toEqual({ left: true, right: true })
  })

  it('captures torso lean but ignores simple whole-body translation', () => {
    const session = new PoseCalibrationSession()
    const now = establishNeutral(session)

    captureBoth(session, 'move-left', 'move-right', now)
    session.advance()

    ingestFrame(
      session,
      withPoseTranslation(createSyntheticPoseFrame('neutral', { timestampMs: now + 200 }), 0.16, 0),
    )
    ingestFrame(
      session,
      withPoseTranslation(createSyntheticPoseFrame('neutral', { timestampMs: now + 250 }), 0.16, 0),
    )
    expect(session.getSnapshot().sideProgress).toEqual({ left: false, right: false })

    captureBoth(session, 'lean-left', 'lean-right', now + 300)

    expect(session.getSnapshot().measurements.lean.leftRangeBodyUnits).toBeGreaterThan(0)
    expect(session.getSnapshot().measurements.lean.rightRangeBodyUnits).toBeGreaterThan(0)
  })

  it('requires relaxed arms before REACH collection and ignores an already-extended arm', () => {
    const session = new PoseCalibrationSession()
    let now = establishNeutral(session)
    now = captureBoth(session, 'move-left', 'move-right', now)
    session.advance()
    now = captureBoth(session, 'lean-left', 'lean-right', now)
    session.advance()

    ingest(session, 'reach-left', now)
    ingest(session, 'reach-left', now + 50)
    expect(session.getSnapshot().reachReadyForMotion).toBe(false)
    expect(session.getSnapshot().sideProgress).toEqual({ left: false, right: false })

    now = prepareReach(session, now + 100)
    ingest(session, 'neutral', now)
    ingest(session, 'neutral', now + 50)
    expect(session.getSnapshot().sideProgress).toEqual({ left: false, right: false })
  })

  it('preserves anatomical left and right REACH capability', () => {
    const session = new PoseCalibrationSession()
    let now = establishNeutral(session)
    now = captureBoth(session, 'move-left', 'move-right', now)
    session.advance()
    now = captureBoth(session, 'lean-left', 'lean-right', now)
    session.advance()
    now = prepareReach(session, now)

    ingest(session, 'reach-left', now)
    ingest(session, 'reach-left', now + 50)
    expect(session.getSnapshot().sideProgress).toEqual({ left: true, right: false })
    ingest(session, 'reach-right', now + 100)
    ingest(session, 'reach-right', now + 150)

    const reach = session.getSnapshot().measurements.reach
    expect(reach.leftCapability).toBeGreaterThan(0.8)
    expect(reach.rightCapability).toBeGreaterThan(0.8)
  })

  it('captures comfortable squat depth in body units', () => {
    const session = new PoseCalibrationSession()
    const now = establishNeutral(session)
    session.skip()
    session.skip()
    session.skip()

    ingest(session, 'squat', now)
    ingest(session, 'squat', now + 50)

    expect(session.getSnapshot().measurements.squat.comfortableDepthBodyUnits).toBeGreaterThan(0.3)
    expect(session.getSnapshot().readyToAdvance).toBe(true)
  })
})

describe('PoseCalibrationSession flow and safety', () => {
  it('supports the normal sequence and produces a COMPLETE result', () => {
    const session = new PoseCalibrationSession()

    completeAllMeasurements(session)

    expect(session.getSnapshot().step).toBe('REVIEW')
    expect(session.getResult()).toMatchObject({ version: 1, status: 'COMPLETE' })
    session.advance()
    expect(session.getSnapshot().step).toBe('COMPLETE')
  })

  it('retry clears only the current step measurement', () => {
    const session = new PoseCalibrationSession()
    const now = establishNeutral(session)
    captureBoth(session, 'move-left', 'move-right', now)
    session.advance()
    ingest(session, 'lean-left', now + 300)
    ingest(session, 'lean-left', now + 350)

    session.retry()

    expect(session.getSnapshot().measurements.move.leftRangeBodyUnits).toBeGreaterThan(0)
    expect(session.getSnapshot().measurements.lean).toEqual({
      leftRangeBodyUnits: null,
      rightRangeBodyUnits: null,
    })
  })

  it('skip records unavailable data and yields a PARTIAL result', () => {
    const session = new PoseCalibrationSession()
    establishNeutral(session)
    session.skip()
    session.skip()
    session.skip()
    session.skip()

    const result = session.getResult()
    expect(result).toMatchObject({
      version: 1,
      status: 'PARTIAL',
      steps: { MOVE: 'SKIPPED', LEAN: 'SKIPPED', REACH: 'SKIPPED', SQUAT: 'SKIPPED' },
      pose: {
        move: { leftRangeBodyUnits: null, rightRangeBodyUnits: null },
        squat: { comfortableDepthBodyUnits: null },
      },
    })
  })

  it('tracking failure does not erase previously completed steps', () => {
    const session = new PoseCalibrationSession()
    const now = establishNeutral(session)
    captureBoth(session, 'move-left', 'move-right', now)
    session.advance()

    ingestFrame(
      session,
      createSyntheticPoseFrame('neutral', { timestampMs: now + 2_000, missingPose: true }),
    )

    expect(session.getSnapshot()).toMatchObject({
      step: 'LEAN',
      collectionState: 'WAITING_FOR_TRACKING',
      stepStatuses: { MOVE: 'COMPLETE' },
    })
    expect(session.getSnapshot().measurements.move.leftRangeBodyUnits).toBeGreaterThan(0)
  })

  it('reset returns a clean session', () => {
    const session = new PoseCalibrationSession()
    establishNeutral(session)

    session.reset()

    expect(session.getSnapshot()).toMatchObject({
      step: 'WELCOME',
      readyToAdvance: true,
      reachReadyForMotion: null,
      stepStatuses: {
        NEUTRAL: 'PENDING',
        MOVE: 'PENDING',
        LEAN: 'PENDING',
        REACH: 'PENDING',
        SQUAT: 'PENDING',
      },
    })
    expect(session.getResult()).toBeNull()
  })

  it('returns normalized derived data without raw poses, landmarks, or frames', () => {
    const session = new PoseCalibrationSession()
    completeAllMeasurements(session)

    const serialized = JSON.stringify(session.getResult())
    expect(serialized).not.toMatch(/landmark|poses|sourceWidth|sourceHeight|frame/i)
  })
})
