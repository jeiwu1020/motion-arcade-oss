import { describe, expect, it } from 'vitest'

import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { createSyntheticPoseFrame } from '../pose/syntheticPoseFixtures'
import { SPORTS_MOTION_CONFIG } from './sportsMotionConfig'
import { PoseSportsMotionTracker } from './PoseSportsMotionTracker'

const LEFT_WRIST = 15
const RIGHT_WRIST = 16

function scaledSweepFrame(
  timestampMs: number,
  scale: number,
  hand: 'LEFT' | 'RIGHT',
  offsetX: number,
  offsetY = 0,
): PoseSensorFrame {
  const frame = createSyntheticPoseFrame('neutral', { timestampMs })
  const pose = frame.poses[0]
  if (!pose) throw new Error('Synthetic fixture must contain one pose.')
  const wristIndex = hand === 'LEFT' ? LEFT_WRIST : RIGHT_WRIST
  const landmarks = pose.landmarks.map((point, index) => ({
    ...point,
    x: 0.5 + (point.x - 0.5) * scale + (index === wristIndex ? offsetX * scale : 0),
    y: 0.5 + (point.y - 0.5) * scale + (index === wristIndex ? offsetY * scale : 0),
  }))
  return { ...frame, poses: [{ ...pose, landmarks }] }
}

function swing(
  tracker: PoseSportsMotionTracker,
  hand: 'LEFT' | 'RIGHT',
  scale = 1,
  offsetX = 0.03,
  offsetY = 0,
  startAt = 0,
): void {
  tracker.ingest(scaledSweepFrame(startAt, scale, hand, 0, 0))
  tracker.ingest(scaledSweepFrame(startAt + 100, scale, hand, offsetX, offsetY))
  tracker.ingest(scaledSweepFrame(startAt + 200, scale, hand, offsetX * 2, offsetY * 2))
}

describe('PoseSportsMotionTracker', () => {
  it('preserves anatomical side and canonical source coordinates without display mirroring', () => {
    const tracker = new PoseSportsMotionTracker()
    tracker.ingest(scaledSweepFrame(100, 1, 'LEFT', 0, 0))

    expect(tracker.getSnapshot(100)).toMatchObject({
      leftHand: { availability: 'AVAILABLE', x: 0.61, y: 0.57 },
      rightHand: { availability: 'AVAILABLE', x: 0.39, y: 0.57 },
    })
  })

  it('normalizes the same physical sweep equivalently across reasonable apparent body scales', () => {
    const near = new PoseSportsMotionTracker()
    const far = new PoseSportsMotionTracker()
    swing(near, 'LEFT', 1.25)
    swing(far, 'LEFT', 0.75)
    const nearEvent = near.getSnapshot(200).leftSwing
    const farEvent = far.getSnapshot(200).leftSwing

    expect(nearEvent).toMatchObject({ hand: 'LEFT', sequence: 1 })
    expect(farEvent).toMatchObject({ hand: 'LEFT', sequence: 1 })
    expect(nearEvent?.speed).toBeCloseTo(farEvent?.speed ?? 0, 4)
    expect(nearEvent?.intensity).toBeCloseTo(farEvent?.intensity ?? 0, 4)
  })

  it.each([
    ['left-to-right', 0.03, 0, 1, 0],
    ['right-to-left', -0.03, 0, -1, 0],
    ['upward', 0, -0.03, 0, -1],
    ['downward', 0, 0.03, 0, 1],
  ] as const)('preserves broad %s vector fidelity', (_name, offsetX, offsetY, vectorX, vectorY) => {
    const tracker = new PoseSportsMotionTracker()
    swing(tracker, 'LEFT', 1, offsetX, offsetY)

    expect(tracker.getSnapshot(200).leftSwing).toMatchObject({ vectorX, vectorY })
  })

  it('emits independent left/right swings once and never fabricates a swing after loss or a stale gap', () => {
    const tracker = new PoseSportsMotionTracker()
    swing(tracker, 'LEFT')
    swing(tracker, 'RIGHT', 1, 0.03, 0, 300)
    expect(tracker.getSnapshot(500)).toMatchObject({
      leftSwing: { hand: 'LEFT', sequence: 1 },
      rightSwing: { hand: 'RIGHT', sequence: 1 },
    })

    tracker.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 600, missingPose: true }))
    expect(tracker.getSnapshot(600)).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: { availability: 'UNAVAILABLE' },
      leftSwing: null,
      rightSwing: null,
    })
    tracker.ingest(scaledSweepFrame(700, 1, 'LEFT', 0.25, 0))
    expect(tracker.getSnapshot(700).leftSwing).toBeNull()

    expect(tracker.getSnapshot(700 + SPORTS_MOTION_CONFIG.maximumSampleGapMs + 1)).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' },
      leftSwing: null,
    })
  })

  it('publishes only immutable sanitized output', () => {
    const tracker = new PoseSportsMotionTracker()
    swing(tracker, 'LEFT')
    const snapshot = tracker.getSnapshot(200)

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.leftHand)).toBe(true)
    expect(Object.isFrozen(snapshot.leftSwing)).toBe(true)
    expect(JSON.stringify(snapshot)).not.toMatch(/landmark|poses|sourceWidth|sourceHeight|frame/i)
  })
})
