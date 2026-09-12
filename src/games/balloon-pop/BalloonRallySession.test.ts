import { describe, expect, it } from 'vitest'

import { SpatialCollisionInputAdapter } from '../../spatial/SpatialCollisionInputAdapter'
import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import { BALLOON_RALLY_RULES } from './BalloonRallyCore'
import { BalloonRallySession } from './BalloonRallySession'
import { resolveBalloonRallyTrackingInput } from './BalloonRallyTrackingPolicy'

const GEOMETRY = {
  source: { width: 1280, height: 720 },
  stage: { width: 1280, height: 720 },
}

type SourcePoint = Readonly<{ x: number; y: number }> | null

function spatial(sequence: number, left: SourcePoint, right: SourcePoint): SpatialHandSnapshot {
  const hand = (point: SourcePoint) =>
    point === null
      ? { availability: 'UNAVAILABLE' as const, timestampMs: sequence * 10, sequence }
      : { availability: 'AVAILABLE' as const, x: point.x, y: point.y, confidence: 1, timestampMs: sequence * 10, sequence }
  return Object.freeze({
    timestampMs: sequence * 10,
    sequence,
    leftHand: Object.freeze(hand(left)),
    rightHand: Object.freeze(hand(right)),
  })
}

describe('Balloon Rally spatial session', () => {
  it('continues through the first 3 seconds, keeps advancing during soft recovery, then freezes at 6 seconds', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 2 })
    await session.start()
    spatialInput.ingest(spatial(1, null, null), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, true)

    session.tick(2_900, false)
    expect(session.getState().elapsedMs).toBe(2_900)
    expect(session.getPresentationSnapshot().trackingState).toBe('DEGRADED')

    session.tick(200, false)
    expect(session.getState().elapsedMs).toBe(3_100)
    expect(session.getPresentationSnapshot().trackingState).toBe('SOFT_RECOVERY')
    session.tick(2_899, false)
    expect(session.getState().elapsedMs).toBe(5_999)
    session.tick(1, false)
    expect(session.getState().elapsedMs).toBe(6_000)
    expect(session.getPresentationSnapshot().trackingState).toBe('HARD_PAUSE')
    const hardPaused = session.getState()
    session.tick(500, false)
    expect(session.getState()).toEqual(hardPaused)
    await session.stop()
  })

  it.each([
    ['left', { x: 0.5, y: 0.5 } as SourcePoint, null as SourcePoint],
    ['right', null as SourcePoint, { x: 0.5, y: 0.5 } as SourcePoint],
  ] as const)('keeps playing and scores with an available %s hand during runtime tracking loss', async (side, initialLeft, initialRight) => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 21 })
    await session.start()
    spatialInput.ingest(spatial(1, null, null), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, resolveBalloonRallyTrackingInput({
      phase: 'COUNTDOWN',
      runtimeReady: true,
      hardFailure: false,
      spatialSnapshot: spatial(1, null, null),
    }))
    const balloon = session.getState().balloons[0]
    const point = {
      x: 1 - (balloon?.x ?? 640) / 1280,
      y: (balloon?.y ?? 360) / 720,
    }
    const left = side === 'left' ? point : initialLeft
    const right = side === 'right' ? point : initialRight
    const trackingLostSpatial = spatial(2, left, right)
    spatialInput.ingest(trackingLostSpatial, GEOMETRY)
    session.tick(100, resolveBalloonRallyTrackingInput({
      phase: 'PLAYING',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: trackingLostSpatial,
    }))

    expect(session.getState()).toMatchObject({ hits: 1, score: 1, elapsedMs: 100 })
    expect(session.getPresentationSnapshot().trackingState).toBe('NORMAL')
    await session.stop()
  })

  it('uses degraded then soft/hard recovery when runtime tracking is lost and both spatial hands are unavailable', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 21 })
    await session.start()
    const unavailable = spatial(1, null, null)
    spatialInput.ingest(unavailable, GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, resolveBalloonRallyTrackingInput({
      phase: 'COUNTDOWN',
      runtimeReady: true,
      hardFailure: false,
      spatialSnapshot: unavailable,
    }))

    session.tick(2_900, resolveBalloonRallyTrackingInput({
      phase: 'PLAYING',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: unavailable,
    }))
    expect(session.getPresentationSnapshot().trackingState).toBe('DEGRADED')
    session.tick(200, resolveBalloonRallyTrackingInput({
      phase: 'PLAYING',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: unavailable,
    }))
    expect(session.getPresentationSnapshot().trackingState).toBe('SOFT_RECOVERY')
    session.tick(2_900, resolveBalloonRallyTrackingInput({
      phase: 'PLAYING',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: unavailable,
    }))
    expect(session.getPresentationSnapshot().trackingState).toBe('HARD_PAUSE')
    await session.stop()
  })

  it('does not allow a spatial hand to start countdown before strict runtime readiness', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 21 })
    await session.start()
    const leftAvailable = spatial(1, { x: 0.5, y: 0.5 }, null)
    spatialInput.ingest(leftAvailable, GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, resolveBalloonRallyTrackingInput({
      phase: 'COUNTDOWN',
      runtimeReady: false,
      hardFailure: false,
      spatialSnapshot: leftAvailable,
    }))

    expect(session.getState()).toMatchObject({ phase: 'COUNTDOWN', countdownRemainingMs: 3_000 })
    await session.stop()
  })

  it('uses the virtual hand radius and tolerance without changing the visible balloon radius', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 13 })
    await session.start()
    spatialInput.ingest(spatial(1, null, null), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, true)
    const balloon = session.getState().balloons[0]
    expect(balloon).toBeDefined()

    const logicalX = (balloon?.x ?? 640) + 115
    spatialInput.ingest(spatial(2, { x: 1 - logicalX / 1280, y: (balloon?.y ?? 360) / 720 }, null), GEOMETRY)
    session.tick(0, true)

    expect(session.getState()).toMatchObject({ hits: 1, score: 1 })
    expect(session.getState().balloons.find((candidate) => candidate.id === balloon?.id)?.radius).toBe(68)
    await session.stop()
  })

  it('turns a swept wrist segment into one core contact and never double-consumes its sample', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 3 })
    await session.start()
    spatialInput.ingest(spatial(1, { x: 0.1, y: 0.5 }, null), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, true)
    const balloon = session.getState().balloons[0]
    expect(balloon).toBeDefined()
    const x = 1 - (balloon?.x ?? 640) / 1280
    const y = (balloon?.y ?? 360) / 720
    spatialInput.ingest(spatial(2, { x, y }, null), GEOMETRY)
    session.tick(0, true)
    session.tick(0, true)

    expect(session.getState()).toMatchObject({ hits: 1, score: 1 })
    await session.stop()
  })

  it('keeps left/right contacts independent and breaks continuity once prolonged loss reaches soft recovery', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 5 })
    await session.start()
    spatialInput.ingest(spatial(1, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, true)
    const balloon = session.getState().balloons[0]
    const x = 1 - (balloon?.x ?? 640) / 1280
    const y = (balloon?.y ?? 360) / 720

    spatialInput.ingest(spatial(2, { x, y }, { x, y }), GEOMETRY)
    session.tick(0, true)
    expect(session.getState().hits).toBe(2)

    session.tick(3_000, false)
    const beforeSoftRecovery = session.getState()
    session.tick(1, false)
    expect(session.getState().elapsedMs).toBe(beforeSoftRecovery.elapsedMs + 1)
    expect(session.getPresentationSnapshot().trackingState).toBe('SOFT_RECOVERY')

    spatialInput.ingest(spatial(3, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }), GEOMETRY)
    session.tick(0, true)
    expect(session.getState().hits).toBe(2)
    await session.stop()
  })

  it('requires a hand to leave a balloon before that same anatomical hand can score it again', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 8 })
    await session.start()
    spatialInput.ingest(spatial(1, { x: 0.1, y: 0.5 }, null), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, true)
    const balloon = session.getState().balloons[0]
    const contact = {
      x: 1 - (balloon?.x ?? 640) / 1280,
      y: (balloon?.y ?? 360) / 720,
    }

    spatialInput.ingest(spatial(2, contact, null), GEOMETRY)
    session.tick(0, true)
    spatialInput.ingest(spatial(3, contact, null), GEOMETRY)
    session.tick(0, true)
    expect(session.getState().hits).toBe(1)

    spatialInput.ingest(spatial(4, { x: 0.02, y: 0.02 }, null), GEOMETRY)
    session.tick(0, true)
    spatialInput.ingest(spatial(5, contact, null), GEOMETRY)
    session.tick(0, true)
    expect(session.getState().hits).toBe(2)
    await session.stop()
  })

  it('exposes only logical hand visuals for the production glow and preserves anatomical identity', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 12 })
    await session.start()
    const source = spatial(1, { x: 0.2, y: 0.3 }, null)
    spatialInput.ingest(source, GEOMETRY)
    const visuals = session.getHandVisualSnapshot()

    expect(visuals).toEqual([
      { side: 'LEFT', availability: 'AVAILABLE', x: 1024, y: 216 },
      { side: 'RIGHT', availability: 'UNAVAILABLE' },
    ])
    expect(JSON.stringify(visuals)).not.toContain('confidence')
    expect(JSON.stringify(visuals)).not.toContain('landmark')
    await session.stop()
  })
})
