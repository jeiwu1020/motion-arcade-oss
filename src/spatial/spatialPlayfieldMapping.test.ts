import { describe, expect, it } from 'vitest'

import type { SpatialHand } from '../motion/contracts/spatial'
import {
  PHASER_LOGICAL_PLAYFIELD,
  calculateCameraVisibleLogicalWorldRect,
  calculateLogicalPlayfieldFitRect,
  mapCameraStagePointToLogicalPlayfield,
  mapSpatialHandToLogicalPlayfield,
} from './spatialPlayfieldMapping'

describe('spatial playfield mapping', () => {
  it('maps a stage point into the centered 1280 by 720 logical world', () => {
    expect(
      mapCameraStagePointToLogicalPlayfield(
        { x: 960, y: 540 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 640, y: 360 })
  })

  it('includes centered Phaser FIT offsets in a taller stage', () => {
    expect(
      calculateLogicalPlayfieldFitRect(
        { width: 1000, height: 1000 },
        PHASER_LOGICAL_PLAYFIELD,
      ),
    ).toEqual({ x: 0, y: 218.75, width: 1000, height: 562.5 })

    expect(
      mapCameraStagePointToLogicalPlayfield(
        { x: 500, y: 500 },
        { width: 1000, height: 1000 },
      ),
    ).toEqual({ x: 640, y: 360 })
  })

  it('does not invent a clamped logical coordinate outside the visible Phaser FIT rectangle', () => {
    expect(
      mapCameraStagePointToLogicalPlayfield(
        { x: 500, y: 100 },
        { width: 1000, height: 1000 },
      ),
    ).toBeNull()
  })

  it('maps an available canonical hand through display mirroring and into logical world coordinates without mutation', () => {
    const hand: SpatialHand = Object.freeze({
      availability: 'AVAILABLE',
      x: 0,
      y: 0.5,
      confidence: 0.9,
      timestampMs: 100,
      sequence: 1,
    })

    expect(
      mapSpatialHandToLogicalPlayfield(
        hand,
        { width: 1440, height: 1080 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 1120, y: 360 })
    expect(hand).toMatchObject({ x: 0, y: 0.5, availability: 'AVAILABLE' })
  })

  it('returns the logical region where camera image and Phaser playfield overlap', () => {
    expect(
      calculateCameraVisibleLogicalWorldRect(
        { width: 1440, height: 1080 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 160, y: 0, width: 960, height: 720 })
  })

  it('recalculates FIT geometry when the stage resizes', () => {
    expect(
      mapCameraStagePointToLogicalPlayfield(
        { x: 960, y: 540 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 640, y: 360 })
    expect(
      mapCameraStagePointToLogicalPlayfield(
        { x: 500, y: 500 },
        { width: 1000, height: 1000 },
      ),
    ).toEqual({ x: 640, y: 360 })
  })
})
