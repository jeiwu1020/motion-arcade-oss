import { describe, expect, it } from 'vitest'

import type { SpatialHand, SpatialHandSnapshot } from '../motion/contracts/spatial'
import { SpatialCollisionInputAdapter } from './SpatialCollisionInputAdapter'

const GEOMETRY = {
  source: { width: 1920, height: 1080 },
  stage: { width: 1920, height: 1080 },
}

function availableHand(
  x: number,
  y: number,
  timestampMs: number,
  sequence: number,
): SpatialHand {
  return Object.freeze({
    availability: 'AVAILABLE' as const,
    x,
    y,
    confidence: 0.9,
    timestampMs,
    sequence,
  })
}

function unavailableHand(timestampMs: number, sequence: number): SpatialHand {
  return Object.freeze({
    availability: 'UNAVAILABLE' as const,
    timestampMs,
    sequence,
  })
}

function snapshot(
  sequence: number,
  timestampMs: number,
  leftHand: SpatialHand,
  rightHand: SpatialHand = unavailableHand(timestampMs, sequence),
): SpatialHandSnapshot {
  return Object.freeze({ timestampMs, sequence, leftHand, rightHand })
}

describe('SpatialCollisionInputAdapter', () => {
  it('creates a segment only between consecutive valid logical hand samples', () => {
    const adapter = new SpatialCollisionInputAdapter()
    adapter.ingest(snapshot(1, 100, availableHand(0.4, 0.5, 100, 1)), GEOMETRY)

    expect(adapter.getSnapshot().leftHand).toMatchObject({
      availability: 'AVAILABLE',
      current: { x: 768, y: 360 },
      segment: null,
    })

    adapter.ingest(snapshot(2, 150, availableHand(0.3, 0.5, 150, 2)), GEOMETRY)

    expect(adapter.getSnapshot().leftHand).toMatchObject({
      availability: 'AVAILABLE',
      current: { x: 896, y: 360 },
      segment: {
        from: { x: 768, y: 360 },
        to: { x: 896, y: 360 },
      },
    })
  })

  it('breaks a segment on unavailable tracking and does not bridge recovery', () => {
    const adapter = new SpatialCollisionInputAdapter()
    adapter.ingest(snapshot(1, 100, availableHand(0.4, 0.5, 100, 1)), GEOMETRY)
    adapter.ingest(snapshot(2, 150, unavailableHand(150, 2)), GEOMETRY)

    expect(adapter.getSnapshot().leftHand).toEqual({
      availability: 'UNAVAILABLE',
      sequence: 2,
    })

    adapter.ingest(snapshot(3, 200, availableHand(0.1, 0.5, 200, 3)), GEOMETRY)
    expect(adapter.getSnapshot().leftHand).toMatchObject({
      availability: 'AVAILABLE',
      current: { x: 1152, y: 360 },
      segment: null,
    })
  })

  it('keeps anatomical hand histories independent', () => {
    const adapter = new SpatialCollisionInputAdapter()
    adapter.ingest(
      snapshot(
        1,
        100,
        availableHand(0.4, 0.5, 100, 1),
        availableHand(0.6, 0.5, 100, 1),
      ),
      GEOMETRY,
    )
    adapter.ingest(
      snapshot(
        2,
        150,
        unavailableHand(150, 2),
        availableHand(0.7, 0.5, 150, 2),
      ),
      GEOMETRY,
    )

    expect(adapter.getSnapshot().leftHand).toMatchObject({
      availability: 'UNAVAILABLE',
    })
    const rightHand = adapter.getSnapshot().rightHand
    expect(rightHand).toMatchObject({
      availability: 'AVAILABLE',
      segment: {
        from: { x: 512, y: 360 },
      },
    })
    if (rightHand.availability !== 'AVAILABLE') {
      throw new Error('Right hand must remain available for this fixture.')
    }
    expect(rightHand.segment?.to.x).toBeCloseTo(384)
    expect(rightHand.segment?.to.y).toBeCloseTo(360)
  })

  it('treats a resized presentation geometry as a fresh logical sample without a false sweep', () => {
    const adapter = new SpatialCollisionInputAdapter()
    const input = snapshot(1, 100, availableHand(0.5, 0.5, 100, 1))
    adapter.ingest(input, {
      source: { width: 1440, height: 1080 },
      stage: { width: 1920, height: 1080 },
    })
    adapter.ingest(input, {
      source: { width: 1440, height: 1080 },
      stage: { width: 1000, height: 1000 },
    })

    expect(adapter.getSnapshot().cameraVisibleWorldRect).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    })
    expect(adapter.getSnapshot().leftHand).toMatchObject({
      availability: 'AVAILABLE',
      current: { x: 640, y: 360 },
      segment: null,
    })
  })

  it('does not bridge a new session generation with an earlier source timestamp', () => {
    const adapter = new SpatialCollisionInputAdapter()
    adapter.ingest(snapshot(5, 500, availableHand(0.4, 0.5, 500, 5)), GEOMETRY)
    adapter.ingest(snapshot(1, 100, availableHand(0.2, 0.5, 100, 1)), GEOMETRY)

    expect(adapter.getSnapshot().leftHand).toMatchObject({
      availability: 'AVAILABLE',
      current: { x: 1024, y: 360 },
      segment: null,
    })
  })
})
