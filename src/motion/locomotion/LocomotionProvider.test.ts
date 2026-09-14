import { describe, expect, it } from 'vitest'

import { LOCOMOTION_CONFIG } from './locomotionConfig'
import {
  LocomotionProvider,
  type LocomotionKinematicSample,
} from './LocomotionProvider'

function sample(timestampMs: number, rawKneeDifferenceBodyUnits = 0): LocomotionKinematicSample {
  return { availability: 'AVAILABLE', timestampMs, rawKneeDifferenceBodyUnits }
}

function unavailable(timestampMs: number): LocomotionKinematicSample {
  return { availability: 'UNAVAILABLE', timestampMs }
}

function step(provider: LocomotionProvider, side: 'LEFT' | 'RIGHT', startAt: number): void {
  const difference = side === 'LEFT' ? 0.5 : -0.5
  provider.ingest(sample(startAt - 10, 0))
  provider.ingest(sample(startAt, difference))
  provider.ingest(sample(startAt + 100, difference))
}

describe('LocomotionProvider', () => {
  it('publishes an immutable sanitized contract with bounded values', () => {
    const provider = new LocomotionProvider()
    step(provider, 'LEFT', 100)
    const snapshot = provider.getSnapshot(200)

    expect(snapshot).toMatchObject({
      availability: 'AVAILABLE',
      latestStep: { side: 'LEFT', sequence: 1, timestampMs: 200 },
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.latestStep)).toBe(true)
    expect(snapshot.cadenceSpm).toBeGreaterThanOrEqual(0)
    expect(snapshot.cadenceSpm).toBeLessThanOrEqual(LOCOMOTION_CONFIG.maximumCadenceSpm)
    expect(snapshot.intensity).toBeGreaterThanOrEqual(0)
    expect(snapshot.intensity).toBeLessThanOrEqual(1)
    expect(snapshot.latestStep?.liftIntensity).toBeGreaterThanOrEqual(0)
    expect(snapshot.latestStep?.liftIntensity).toBeLessThanOrEqual(1)
    expect(JSON.stringify(snapshot)).not.toMatch(/landmark|poses|frame|bodyScale|camera/i)
  })

  it('requires alternating anatomical sides after the first accepted step', () => {
    const provider = new LocomotionProvider()
    step(provider, 'LEFT', 100)
    step(provider, 'RIGHT', 400)
    step(provider, 'LEFT', 700)

    expect(provider.getSnapshot(800).latestStep).toMatchObject({
      side: 'LEFT', sequence: 3, timestampMs: 800,
    })
  })

  it('does not turn repeated same-side lifts into artificial cadence', () => {
    const provider = new LocomotionProvider()
    step(provider, 'LEFT', 100)
    provider.ingest(sample(300, 0))
    provider.ingest(sample(400, 0))
    step(provider, 'LEFT', 500)
    provider.ingest(sample(700, 0))
    step(provider, 'LEFT', 800)

    const snapshot = provider.getSnapshot(900)
    expect(snapshot.latestStep).toMatchObject({ side: 'LEFT', sequence: 1 })
    expect(snapshot.cadenceSpm).toBe(0)
  })

  it('rejects a single threshold spike and enforces the minimum step interval', () => {
    const provider = new LocomotionProvider()
    provider.ingest(sample(0, 0))
    provider.ingest(sample(100, 0.5))
    expect(provider.getSnapshot(100).latestStep).toBeNull()

    provider.ingest(sample(200, 0.5))
    expect(provider.getSnapshot(200).latestStep).toMatchObject({ side: 'LEFT' })
    step(provider, 'RIGHT', 250)
    expect(provider.getSnapshot(350).latestStep).toMatchObject({ side: 'LEFT', sequence: 1 })
  })

  it('calculates deterministic recent-window cadence and caps it', () => {
    const provider = new LocomotionProvider()
    step(provider, 'LEFT', 100)
    provider.ingest(sample(400, 0))
    step(provider, 'RIGHT', 600)
    provider.ingest(sample(900, 0))
    step(provider, 'LEFT', 1_100)
    expect(provider.getSnapshot(1_200).cadenceSpm).toBe(120)

    const capped = new LocomotionProvider()
    step(capped, 'LEFT', 100)
    step(capped, 'RIGHT', 320)
    expect(capped.getSnapshot(420).cadenceSpm).toBe(LOCOMOTION_CONFIG.maximumCadenceSpm)
  })

  it('expires cadence after a hold then a smooth decay while incoming neutral samples continue', () => {
    const provider = new LocomotionProvider()
    step(provider, 'LEFT', 100)
    provider.ingest(sample(400, 0))
    step(provider, 'RIGHT', 600)
    expect(provider.getSnapshot(700).cadenceSpm).toBe(120)
    for (let time = 800; time <= 1_100; time += 100) provider.ingest(sample(time, 0))
    expect(provider.getSnapshot(1_100).cadenceSpm).toBe(120)
    provider.ingest(sample(1_200, 0))
    expect(provider.getSnapshot(1_200).cadenceSpm).toBeLessThan(120)
    for (let time = 1_300; time <= 1_900; time += 100) provider.ingest(sample(time, 0))
    expect(provider.getSnapshot(1_900)).toMatchObject({ cadenceSpm: 0, intensity: 0 })
  })

  it('clears cadence, events, and continuity on invalid input or an excessive gap', () => {
    const provider = new LocomotionProvider()
    step(provider, 'LEFT', 100)
    provider.ingest(unavailable(300))
    expect(provider.getSnapshot(300)).toEqual(expect.objectContaining({
      availability: 'UNAVAILABLE', cadenceSpm: 0, intensity: 0, latestStep: null,
    }))

    provider.ingest(sample(400, 0))
    provider.ingest(sample(400 + LOCOMOTION_CONFIG.maximumContinuityGapMs + 1, 0.5))
    expect(provider.getSnapshot(651).latestStep).toBeNull()
  })

  it('adapts a static neutral asymmetry but never chases an active lift', () => {
    const provider = new LocomotionProvider()
    provider.ingest(sample(0, 0.06))
    for (let time = 100; time <= 900; time += 100) provider.ingest(sample(time, 0.08))
    expect(provider.getSnapshot(900).latestStep).toBeNull()

    provider.ingest(sample(1_000, 0.58))
    provider.ingest(sample(1_100, 0.58))
    expect(provider.getSnapshot(1_100).latestStep).toMatchObject({ side: 'LEFT' })
  })
})
