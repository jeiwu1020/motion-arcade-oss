import { describe, expect, it } from 'vitest'

import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import { resolveBalloonRallyTrackingInput } from './BalloonRallyTrackingPolicy'

function spatial(leftAvailable: boolean, rightAvailable: boolean): SpatialHandSnapshot {
  const hand = (available: boolean) => available
    ? { availability: 'AVAILABLE' as const, x: 0.5, y: 0.5, confidence: 1, timestampMs: 10, sequence: 1 }
    : { availability: 'UNAVAILABLE' as const, timestampMs: 10, sequence: 1 }
  return Object.freeze({
    timestampMs: 10,
    sequence: 1,
    leftHand: Object.freeze(hand(leftAvailable)),
    rightHand: Object.freeze(hand(rightAvailable)),
  })
}

describe('Balloon Rally active tracking policy', () => {
  it.each([
    ['left', true, false],
    ['right', false, true],
  ] as const)('keeps PLAYING useful during runtime tracking loss when the %s hand is available', (_side, left, right) => {
    expect(resolveBalloonRallyTrackingInput({
      phase: 'PLAYING',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: spatial(left, right),
    })).toEqual({ setupReady: false, usefulTracking: true, hardFailure: false })
  })

  it('uses the existing recovery policy when both hands are unavailable during active play', () => {
    expect(resolveBalloonRallyTrackingInput({
      phase: 'PLAYING',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: spatial(false, false),
    })).toEqual({ setupReady: false, usefulTracking: false, hardFailure: false })
  })

  it('keeps pre-game setup strict even if a spatial hand happens to be available', () => {
    expect(resolveBalloonRallyTrackingInput({
      phase: 'COUNTDOWN',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: spatial(true, false),
    })).toEqual({ setupReady: false, usefulTracking: false, hardFailure: false })
  })
})
