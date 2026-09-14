import { describe, expect, it } from 'vitest'

import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import {
  createSyntheticPoseFrame,
  withLandmarkConfidence,
} from '../pose/syntheticPoseFixtures'
import { PoseLocomotionTracker } from './PoseLocomotionTracker'

const LEFT_KNEE = 25
const RIGHT_KNEE = 26
const LEFT_ANKLE = 27
const RIGHT_ANKLE = 28

function kneeLiftFrame(
  timestampMs: number,
  side: 'LEFT' | 'RIGHT' | 'NEUTRAL',
  scale = 1,
  bob = 0,
): PoseSensorFrame {
  const frame = createSyntheticPoseFrame('neutral', { timestampMs })
  const pose = frame.poses[0]
  if (!pose) throw new Error('Synthetic fixture requires a pose.')
  const kneeIndex = side === 'LEFT' ? LEFT_KNEE : side === 'RIGHT' ? RIGHT_KNEE : null
  const landmarks = pose.landmarks.map((point, index) => ({
    ...point,
    x: 0.5 + (point.x - 0.5) * scale,
    y: 0.5 + (point.y - 0.5) * scale + bob + (index === kneeIndex ? -0.11 * scale : 0),
  }))
  return { ...frame, poses: [{ ...pose, landmarks }] }
}

function lift(tracker: PoseLocomotionTracker, side: 'LEFT' | 'RIGHT', startAt: number, scale = 1): void {
  tracker.ingest(kneeLiftFrame(startAt, side, scale))
  tracker.ingest(kneeLiftFrame(startAt + 100, side, scale))
}

describe('PoseLocomotionTracker', () => {
  it('derives anatomical LEFT and RIGHT steps from body-relative knee difference', () => {
    const tracker = new PoseLocomotionTracker()
    tracker.ingest(kneeLiftFrame(0, 'NEUTRAL'))
    lift(tracker, 'LEFT', 100)
    lift(tracker, 'RIGHT', 400)

    expect(tracker.getSnapshot(500).latestStep).toMatchObject({ side: 'RIGHT', sequence: 2 })
  })

  it('rejects neutral standing and common vertical body bob', () => {
    const tracker = new PoseLocomotionTracker()
    for (let time = 0; time <= 500; time += 100) {
      tracker.ingest(kneeLiftFrame(time, 'NEUTRAL', 1, time % 200 === 0 ? -0.04 : 0.04))
    }
    expect(tracker.getSnapshot(500)).toMatchObject({ latestStep: null, cadenceSpm: 0 })
  })

  it('normalizes equivalent knee lifts across reasonable apparent body scales', () => {
    const near = new PoseLocomotionTracker()
    const far = new PoseLocomotionTracker()
    near.ingest(kneeLiftFrame(0, 'NEUTRAL', 1.25))
    far.ingest(kneeLiftFrame(0, 'NEUTRAL', 0.75))
    lift(near, 'LEFT', 100, 1.25)
    lift(far, 'LEFT', 100, 0.75)

    expect(near.getSnapshot(200).latestStep?.liftIntensity).toBeCloseTo(
      far.getSnapshot(200).latestStep?.liftIntensity ?? 0,
      3,
    )
  })

  it('works without ankles but fails closed when either knee or the core is unavailable', () => {
    const tracker = new PoseLocomotionTracker()
    let ankleFree = kneeLiftFrame(0, 'NEUTRAL')
    ankleFree = withLandmarkConfidence(ankleFree, LEFT_ANKLE, 0)
    ankleFree = withLandmarkConfidence(ankleFree, RIGHT_ANKLE, 0)
    tracker.ingest(ankleFree)
    let leftLift = kneeLiftFrame(100, 'LEFT')
    leftLift = withLandmarkConfidence(leftLift, LEFT_ANKLE, 0)
    leftLift = withLandmarkConfidence(leftLift, RIGHT_ANKLE, 0)
    tracker.ingest(leftLift)
    tracker.ingest({ ...leftLift, timestampMs: 200 })
    expect(tracker.getSnapshot(200).latestStep).toMatchObject({ side: 'LEFT' })

    tracker.ingest(withLandmarkConfidence(kneeLiftFrame(300, 'NEUTRAL'), LEFT_KNEE, 0))
    expect(tracker.getSnapshot(300)).toMatchObject({ availability: 'UNAVAILABLE', latestStep: null, cadenceSpm: 0 })
  })
})
