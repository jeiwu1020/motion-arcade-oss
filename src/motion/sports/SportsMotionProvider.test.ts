import { describe, expect, it } from 'vitest'

import { SPORTS_MOTION_CONFIG } from './sportsMotionConfig'
import {
  SportsMotionProvider,
  type SportsMotionKinematicSample,
} from './SportsMotionProvider'

function sample(
  timestampMs: number,
  leftX: number,
  leftY = 0.57,
): SportsMotionKinematicSample {
  return {
    timestampMs,
    leftHand: {
      availability: 'AVAILABLE',
      x: leftX,
      y: leftY,
      confidence: 0.99,
      aspectRatio: 16 / 9,
      bodyScale: 0.25,
    },
    rightHand: { availability: 'UNAVAILABLE' },
  }
}

function deliberateLeftSwing(provider: SportsMotionProvider, startAt = 0): void {
  provider.ingest(sample(startAt, 0.6))
  provider.ingest(sample(startAt + 100, 0.63))
  provider.ingest(sample(startAt + 200, 0.66))
}

describe('SportsMotionProvider', () => {
  it('publishes immutable, anatomical, bounded game-facing state', () => {
    const provider = new SportsMotionProvider()
    provider.ingest(sample(0, 0.6))
    provider.ingest(sample(100, 0.63))

    const snapshot = provider.getSnapshot()
    expect(snapshot.leftHand).toMatchObject({
      availability: 'AVAILABLE',
      x: 0.63,
      y: 0.57,
      vectorX: 1,
      vectorY: 0,
    })
    expect(snapshot.rightHand).toEqual({
      availability: 'UNAVAILABLE',
      timestampMs: 100,
      sequence: snapshot.sequence,
    })
    expect(snapshot.leftHand.availability === 'AVAILABLE' && snapshot.leftHand.intensity)
      .toBeGreaterThanOrEqual(0)
    expect(snapshot.leftHand.availability === 'AVAILABLE' && snapshot.leftHand.intensity)
      .toBeLessThanOrEqual(1)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.leftHand)).toBe(true)
    expect(JSON.stringify(snapshot)).not.toMatch(/landmark|poses|sourceWidth|sourceHeight|frame/i)
  })

  it('scales kinematic speed by aspect-corrected body scale and frame time', () => {
    const provider = new SportsMotionProvider()
    provider.ingest(sample(0, 0.6))
    provider.ingest(sample(100, 0.63))
    const speedAt100ms = provider.getSnapshot().leftHand
    provider.reset()
    provider.ingest(sample(0, 0.6))
    provider.ingest(sample(200, 0.63))
    const speedAt200ms = provider.getSnapshot().leftHand

    expect(speedAt100ms.availability === 'AVAILABLE' && speedAt100ms.speed).toBeCloseTo(2.13, 2)
    expect(speedAt200ms.availability === 'AVAILABLE' && speedAt200ms.speed).toBeCloseTo(1.07, 2)
  })

  it('emits one deliberate swing and does not repeat it during sustained motion', () => {
    const provider = new SportsMotionProvider()
    deliberateLeftSwing(provider)
    const first = provider.getSnapshot().leftSwing
    provider.ingest(sample(300, 0.69))
    provider.ingest(sample(400, 0.72))

    expect(first).toMatchObject({ hand: 'LEFT', sequence: 1, vectorX: 1, vectorY: 0 })
    expect(provider.getSnapshot().leftSwing).toEqual(first)
  })

  it('requires a low-speed re-arm and refractory completion before a second swing', () => {
    const provider = new SportsMotionProvider()
    deliberateLeftSwing(provider)
    provider.ingest(sample(300, 0.66))
    provider.ingest(sample(600, 0.66))
    provider.ingest(sample(700, 0.69))
    provider.ingest(sample(800, 0.72))

    expect(provider.getSnapshot().leftSwing).toMatchObject({ sequence: 2, hand: 'LEFT' })
  })

  it('does not classify a single noisy spike or low-speed jitter as a swing', () => {
    const provider = new SportsMotionProvider()
    provider.ingest(sample(0, 0.6))
    provider.ingest(sample(100, 0.66))
    provider.ingest(sample(200, 0.6))
    provider.ingest(sample(300, 0.603))
    provider.ingest(sample(400, 0.606))

    expect(provider.getSnapshot().leftSwing).toBeNull()
  })

  it('keeps left and right swing sequences independent', () => {
    const provider = new SportsMotionProvider()
    deliberateLeftSwing(provider)
    provider.ingest({
      timestampMs: 600,
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: {
        availability: 'AVAILABLE', x: 0.4, y: 0.57, confidence: 0.99,
        aspectRatio: 16 / 9, bodyScale: 0.25,
      },
    })
    provider.ingest({
      timestampMs: 700,
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: {
        availability: 'AVAILABLE', x: 0.37, y: 0.57, confidence: 0.99,
        aspectRatio: 16 / 9, bodyScale: 0.25,
      },
    })
    provider.ingest({
      timestampMs: 800,
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: {
        availability: 'AVAILABLE', x: 0.34, y: 0.57, confidence: 0.99,
        aspectRatio: 16 / 9, bodyScale: 0.25,
      },
    })

    expect(provider.getSnapshot().leftSwing).toMatchObject({ sequence: 1, hand: 'LEFT' })
    expect(provider.getSnapshot().rightSwing).toMatchObject({ sequence: 1, hand: 'RIGHT' })
  })

  it('resets continuity on stale or non-increasing timestamps without a fake swing', () => {
    const provider = new SportsMotionProvider()
    provider.ingest(sample(100, 0.6))
    provider.ingest(sample(100, 0.8))
    expect(provider.getSnapshot().leftHand).toMatchObject({ speed: 0, vectorX: 0, vectorY: 0 })
    provider.ingest(sample(100 + SPORTS_MOTION_CONFIG.maximumSampleGapMs + 1, 0.9))

    expect(provider.getSnapshot().leftSwing).toBeNull()
    expect(provider.getSnapshot().leftHand).toMatchObject({ speed: 0, vectorX: 0, vectorY: 0 })
  })
})
