import { describe, expect, it } from 'vitest'

import { createSyntheticPoseFrame, withLandmarkConfidence } from '../pose/syntheticPoseFixtures'
import { MIRRORED_PREVIEW_TRANSFORM } from '../../sensors/pose/mirror'
import { PoseSpatialHandTracker } from './PoseSpatialHandTracker'

const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_KNEE = 25
const RIGHT_KNEE = 26
const LEFT_ANKLE = 27
const RIGHT_ANKLE = 28

describe('PoseSpatialHandTracker', () => {
  it('preserves anatomical wrist identity and camera-source coordinates without display mirroring', () => {
    const tracker = new PoseSpatialHandTracker()
    tracker.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 100 }))

    expect(tracker.getSnapshot(100)).toMatchObject({
      timestampMs: 100,
      leftHand: {
        availability: 'AVAILABLE',
        x: 0.61,
        y: 0.57,
        confidence: 0.99,
        timestampMs: 100,
      },
      rightHand: {
        availability: 'AVAILABLE',
        x: 0.39,
        y: 0.57,
        confidence: 0.99,
        timestampMs: 100,
      },
    })
    expect(MIRRORED_PREVIEW_TRANSFORM).toBe('scaleX(-1)')
  })

  it('keeps wrist positions available when lower-body landmarks are unavailable', () => {
    const tracker = new PoseSpatialHandTracker()
    let frame = createSyntheticPoseFrame('neutral', { timestampMs: 100 })
    for (const index of [LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE]) {
      frame = withLandmarkConfidence(frame, index, 0.1)
    }

    tracker.ingest(frame)

    expect(tracker.getSnapshot(100)).toMatchObject({
      leftHand: { availability: 'AVAILABLE', x: 0.61 },
      rightHand: { availability: 'AVAILABLE', x: 0.39 },
    })
  })

  it('marks a missing wrist unavailable without inventing a fallback coordinate', () => {
    const tracker = new PoseSpatialHandTracker()
    const frame = createSyntheticPoseFrame('neutral', { timestampMs: 100 })
    const pose = frame.poses[0]
    if (!pose) throw new Error('Synthetic fixture must contain a pose.')

    tracker.ingest({
      ...frame,
      poses: [{ ...pose, landmarks: pose.landmarks.slice(0, LEFT_WRIST) }],
    })

    const snapshot = tracker.getSnapshot(100)
    expect(snapshot.leftHand).toEqual({
      availability: 'UNAVAILABLE',
      timestampMs: 100,
      sequence: 1,
    })
    expect(snapshot.rightHand).toEqual({
      availability: 'UNAVAILABLE',
      timestampMs: 100,
      sequence: 1,
    })
  })

  it('marks low-confidence wrists unavailable', () => {
    const tracker = new PoseSpatialHandTracker()
    let frame = createSyntheticPoseFrame('neutral', { timestampMs: 100 })
    frame = withLandmarkConfidence(frame, LEFT_WRIST, 0.54)
    frame = withLandmarkConfidence(frame, RIGHT_WRIST, 0.2)

    tracker.ingest(frame)

    expect(tracker.getSnapshot(100)).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: { availability: 'UNAVAILABLE' },
    })
  })

  it('marks out-of-source wrist coordinates unavailable rather than clamping them to an edge', () => {
    const tracker = new PoseSpatialHandTracker()
    const frame = createSyntheticPoseFrame('neutral', { timestampMs: 100 })
    const pose = frame.poses[0]
    if (!pose) throw new Error('Synthetic fixture must contain a pose.')
    const landmarks = pose.landmarks.map((landmark, index) =>
      index === LEFT_WRIST ? { ...landmark, x: 1.02 } : landmark,
    )

    tracker.ingest({ ...frame, poses: [{ ...pose, landmarks }] })

    expect(tracker.getSnapshot(100)).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: { availability: 'AVAILABLE', x: 0.39, y: 0.57 },
    })
  })

  it('becomes unavailable after the shared Pose freshness interval and recovers from a new valid sample', () => {
    const tracker = new PoseSpatialHandTracker()
    tracker.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 100 }))

    const stale = tracker.getSnapshot(351)
    expect(stale.leftHand).toMatchObject({ availability: 'UNAVAILABLE' })
    expect(stale.rightHand).toMatchObject({ availability: 'UNAVAILABLE' })

    tracker.ingest(createSyntheticPoseFrame('reach-left', { timestampMs: 400 }))

    expect(tracker.getSnapshot(400)).toMatchObject({
      leftHand: {
        availability: 'AVAILABLE',
        x: 0.81,
        y: 0.32,
        sequence: 2,
      },
      rightHand: {
        availability: 'AVAILABLE',
        x: 0.39,
        y: 0.57,
        sequence: 2,
      },
    })
  })

  it('publishes an immutable contract without raw landmark arrays or pose frames', () => {
    const tracker = new PoseSpatialHandTracker()
    tracker.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 100 }))

    const snapshot = tracker.getSnapshot(100)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.leftHand)).toBe(true)
    expect(Object.isFrozen(snapshot.rightHand)).toBe(true)
    expect(JSON.stringify(snapshot)).not.toMatch(/landmark|poses|sourceWidth|sourceHeight|frame/i)
  })
})
