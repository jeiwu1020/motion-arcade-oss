import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { PoseTrackingSnapshot } from '../../motion/contracts/poseTracking'
import { CameraPoseTrackingOverlay } from './CameraPoseTrackingOverlay'

const point = (x: number | null, y: number | null, valid = true) => ({
  x,
  y,
  confidence: valid ? 0.9 : 0.3,
  valid,
})

const SNAPSHOT: PoseTrackingSnapshot = Object.freeze({
  timestampMs: 100,
  sequence: 1,
  posePresent: true,
  joints: Object.freeze({
    leftShoulder: point(0.6, 0.3), rightShoulder: point(0.4, 0.3),
    leftElbow: point(0.65, 0.4), rightElbow: point(0.35, 0.4),
    leftWrist: point(0.75, 0.5), rightWrist: point(0.25, 0.5, false),
    leftHip: point(0.55, 0.55), rightHip: point(0.45, 0.55),
    leftKnee: point(0.55, 0.7), rightKnee: point(0.45, 0.7),
    leftAnkle: point(0.55, 0.9), rightAnkle: point(null, null, false),
  }),
})

describe('CameraPoseTrackingOverlay', () => {
  it('maps selected source joints through the shared mirrored contain-fit boundary without exposing labels or raw data', () => {
    const markup = renderToStaticMarkup(
      <CameraPoseTrackingOverlay
        snapshot={SNAPSHOT}
        sourceDimensions={{ width: 1000, height: 1000 }}
        stageDimensions={{ width: 1000, height: 1000 }}
      />,
    )

    // Source x .75 mirrors to x 250 while y remains source-top-to-bottom.
    expect(markup).toContain('cx="250" cy="500"')
    expect(markup).toContain('data-pose-joint="leftWrist"')
    expect(markup).toContain('data-pose-confidence="LOW"')
    expect(markup).not.toContain('rightAnkle')
    expect(markup).not.toContain('landmarks')
  })
})
