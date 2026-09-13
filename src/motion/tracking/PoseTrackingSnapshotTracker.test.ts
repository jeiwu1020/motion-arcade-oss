import { describe, expect, it } from 'vitest'

import { PoseTrackingSnapshotTracker } from './PoseTrackingSnapshotTracker'
import {
  createSyntheticPoseFrame,
  withLandmarkConfidence,
} from '../pose/syntheticPoseFixtures'

describe('PoseTrackingSnapshotTracker', () => {
  it('publishes only the selected source-normalized joints with original confidence', () => {
    const tracker = new PoseTrackingSnapshotTracker()
    tracker.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 100 }))

    const snapshot = tracker.getSnapshot(100)

    expect(Object.keys(snapshot.joints).sort()).toEqual([
      'leftAnkle', 'leftElbow', 'leftHip', 'leftKnee', 'leftShoulder', 'leftWrist',
      'rightAnkle', 'rightElbow', 'rightHip', 'rightKnee', 'rightShoulder', 'rightWrist',
    ])
    expect(snapshot.joints.leftWrist).toMatchObject({
      x: 0.61,
      y: 0.57,
      confidence: 0.99,
      valid: true,
    })
    expect(snapshot).not.toHaveProperty('poses')
    expect(snapshot).not.toHaveProperty('landmarks')
  })

  it('keeps finite low-confidence points visible but invalid and leaves missing points coordinate-free', () => {
    const tracker = new PoseTrackingSnapshotTracker()
    tracker.ingest(withLandmarkConfidence(
      createSyntheticPoseFrame('neutral', { timestampMs: 100 }),
      15,
      0.2,
    ))

    const lowConfidence = tracker.getSnapshot(100).joints.leftWrist
    expect(lowConfidence).toEqual({ x: 0.61, y: 0.57, confidence: 0.2, valid: false })

    tracker.ingest({
      timestampMs: 200,
      sourceWidth: 1280,
      sourceHeight: 720,
      poses: [],
    })
    expect(tracker.getSnapshot(200).joints.leftWrist).toEqual({
      x: null,
      y: null,
      confidence: 0,
      valid: false,
    })
  })

  it('makes stale and reset snapshots coordinate-free without retaining raw frames', () => {
    const tracker = new PoseTrackingSnapshotTracker({ staleAfterMs: 250 })
    tracker.ingest(createSyntheticPoseFrame('neutral', { timestampMs: 100 }))

    expect(tracker.getSnapshot(351).joints.rightWrist.valid).toBe(false)
    expect(tracker.getSnapshot(351).joints.rightWrist.x).toBeNull()

    tracker.reset(400)
    const reset = tracker.getSnapshot(400)
    expect(reset.posePresent).toBe(false)
    expect(reset.joints.leftShoulder).toEqual({
      x: null,
      y: null,
      confidence: 0,
      valid: false,
    })
  })
})
