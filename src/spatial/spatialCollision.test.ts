import { describe, expect, it } from 'vitest'

import {
  SpatialCircleContactTracker,
  doesSegmentIntersectCircle,
  type SpatialCircleTarget,
  type SpatialHandContactSample,
} from './spatialCollision'

const TARGET: SpatialCircleTarget = Object.freeze({
  id: 'probe',
  x: 500,
  y: 300,
  radius: 40,
})

function hand(
  side: 'LEFT' | 'RIGHT',
  sequence: number,
  current: { x: number; y: number } | null,
  segment: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null,
): SpatialHandContactSample {
  return { side, sequence, current, segment }
}

describe('doesSegmentIntersectCircle', () => {
  it('detects a fast segment crossing a target when neither endpoint is inside', () => {
    expect(
      doesSegmentIntersectCircle(
        { from: { x: 400, y: 300 }, to: { x: 600, y: 300 } },
        TARGET,
      ),
    ).toBe(true)
  })

  it('does not report a segment that misses the target', () => {
    expect(
      doesSegmentIntersectCircle(
        { from: { x: 400, y: 360 }, to: { x: 600, y: 360 } },
        TARGET,
      ),
    ).toBe(false)
  })

  it('detects endpoint entry into the target', () => {
    expect(
      doesSegmentIntersectCircle(
        { from: { x: 420, y: 300 }, to: { x: 480, y: 300 } },
        TARGET,
      ),
    ).toBe(true)
  })
})

describe('SpatialCircleContactTracker', () => {
  it('emits one hit on entry and not while a hand remains inside', () => {
    const tracker = new SpatialCircleContactTracker()

    expect(tracker.update(hand('LEFT', 1, { x: 420, y: 300 }), TARGET)).toBe(false)
    expect(tracker.update(hand('LEFT', 2, { x: 480, y: 300 }), TARGET)).toBe(true)
    expect(tracker.update(hand('LEFT', 3, { x: 500, y: 300 }), TARGET)).toBe(false)
    expect(tracker.update(hand('LEFT', 3, { x: 500, y: 300 }), TARGET)).toBe(false)
  })

  it('allows a second hit only after the hand leaves and re-enters', () => {
    const tracker = new SpatialCircleContactTracker()

    expect(tracker.update(hand('LEFT', 1, { x: 500, y: 300 }), TARGET)).toBe(true)
    expect(tracker.update(hand('LEFT', 2, { x: 420, y: 300 }), TARGET)).toBe(false)
    expect(tracker.update(hand('LEFT', 3, { x: 500, y: 300 }), TARGET)).toBe(true)
  })

  it('keeps left and right contact state independent', () => {
    const tracker = new SpatialCircleContactTracker()

    expect(tracker.update(hand('LEFT', 1, { x: 500, y: 300 }), TARGET)).toBe(true)
    expect(tracker.update(hand('RIGHT', 1, { x: 500, y: 300 }), TARGET)).toBe(true)
  })

  it('resets contact when an unavailable sample arrives', () => {
    const tracker = new SpatialCircleContactTracker()

    expect(tracker.update(hand('LEFT', 1, { x: 500, y: 300 }), TARGET)).toBe(true)
    expect(tracker.update(hand('LEFT', 2, null), TARGET)).toBe(false)
    expect(tracker.update(hand('LEFT', 3, { x: 500, y: 300 }), TARGET)).toBe(true)
  })
})
