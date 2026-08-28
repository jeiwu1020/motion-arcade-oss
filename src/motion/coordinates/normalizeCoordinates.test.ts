import { describe, expect, it } from 'vitest'

import {
  canonicalizeHorizontalDelta,
  canonicalizeSourcePoint,
  getAnatomicalSide,
  getWorldHorizontalDirection,
} from './normalizeCoordinates'

describe('canonical coordinate semantics', () => {
  it('keeps non-mirrored detector coordinates in logical playfield space', () => {
    expect(
      canonicalizeSourcePoint(
        { x: 0.2, y: 0.75 },
        { sourceCoordinates: 'CANONICAL' },
      ),
    ).toEqual({ x: 0.2, y: 0.75 })
  })

  it('unmirrors source coordinates exactly once at the transform boundary', () => {
    expect(
      canonicalizeSourcePoint(
        { x: 0.2, y: 0.75 },
        { sourceCoordinates: 'MIRRORED' },
      ),
    ).toEqual({ x: 0.8, y: 0.75 })

    expect(
      canonicalizeHorizontalDelta(-0.4, {
        sourceCoordinates: 'MIRRORED',
      }),
    ).toBeCloseTo(0.4)
  })

  it('uses projected world direction after canonicalization', () => {
    expect(getWorldHorizontalDirection(-0.01)).toBe('LEFT')
    expect(getWorldHorizontalDirection(0.01)).toBe('RIGHT')
    expect(getWorldHorizontalDirection(0)).toBe('NONE')
  })

  it('never swaps anatomical side because a preview is mirrored', () => {
    expect(getAnatomicalSide('STRIKE_LEFT')).toBe('LEFT')
    expect(getAnatomicalSide('HAND_POSITION_RIGHT')).toBe('RIGHT')
    expect(getAnatomicalSide('REACH_LEFT')).toBe('LEFT')
    expect(getAnatomicalSide('ARM_SWING_RIGHT')).toBe('RIGHT')
  })
})
