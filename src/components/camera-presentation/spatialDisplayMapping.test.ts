import { describe, expect, it } from 'vitest'

import type { SpatialHand } from '../../motion/contracts/spatial'
import {
  calculateContainFitRect,
  mapCanonicalSourcePointToMirroredStage,
  mapSpatialHandToMirroredStage,
} from './spatialDisplayMapping'

describe('spatial display mapping', () => {
  it('maps a same-aspect source point into the mirrored stage without offsets', () => {
    expect(
      mapCanonicalSourcePointToMirroredStage(
        { x: 0.25, y: 0.75 },
        { width: 1920, height: 1080 },
        { width: 960, height: 540 },
      ),
    ).toEqual({ x: 720, y: 405 })
  })

  it('includes vertical contain-fit letterbox offsets', () => {
    expect(
      calculateContainFitRect(
        { width: 1920, height: 1080 },
        { width: 1200, height: 1080 },
      ),
    ).toEqual({ x: 0, y: 202.5, width: 1200, height: 675 })

    expect(
      mapCanonicalSourcePointToMirroredStage(
        { x: 0, y: 0 },
        { width: 1920, height: 1080 },
        { width: 1200, height: 1080 },
      ),
    ).toEqual({ x: 1200, y: 202.5 })
  })

  it('includes horizontal contain-fit pillarbox offsets', () => {
    expect(
      calculateContainFitRect(
        { width: 1920, height: 1080 },
        { width: 2400, height: 900 },
      ),
    ).toEqual({ x: 400, y: 0, width: 1600, height: 900 })

    expect(
      mapCanonicalSourcePointToMirroredStage(
        { x: 0, y: 1 },
        { width: 1920, height: 1080 },
        { width: 2400, height: 900 },
      ),
    ).toEqual({ x: 2000, y: 900 })
  })

  it('keeps the source center visually centered, mirrors only x, and preserves y', () => {
    const source = { width: 1920, height: 1080 }
    const stage = { width: 1000, height: 1000 }

    expect(
      mapCanonicalSourcePointToMirroredStage({ x: 0.5, y: 0.5 }, source, stage),
    ).toEqual({ x: 500, y: 500 })
    expect(
      mapCanonicalSourcePointToMirroredStage({ x: 0, y: 0.2 }, source, stage),
    ).toEqual({ x: 1000, y: 331.25 })
    expect(
      mapCanonicalSourcePointToMirroredStage({ x: 1, y: 0.2 }, source, stage),
    ).toEqual({ x: 0, y: 331.25 })
  })

  it('returns no display point for an unavailable hand without mutating the source hand', () => {
    const hand: SpatialHand = Object.freeze({
      availability: 'UNAVAILABLE',
      timestampMs: 100,
      sequence: 1,
    })

    expect(
      mapSpatialHandToMirroredStage(
        hand,
        { width: 1920, height: 1080 },
        { width: 960, height: 540 },
      ),
    ).toBeNull()
    expect(hand).toEqual({
      availability: 'UNAVAILABLE',
      timestampMs: 100,
      sequence: 1,
    })
  })

  it('recalculates the display point when stage dimensions change', () => {
    const source = { width: 1920, height: 1080 }
    const point = { x: 0.25, y: 0.5 }

    expect(
      mapCanonicalSourcePointToMirroredStage(point, source, {
        width: 960,
        height: 540,
      }),
    ).toEqual({ x: 720, y: 270 })
    expect(
      mapCanonicalSourcePointToMirroredStage(point, source, {
        width: 600,
        height: 900,
      }),
    ).toEqual({ x: 450, y: 450 })
  })
})
