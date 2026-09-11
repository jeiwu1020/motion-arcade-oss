import { describe, expect, it } from 'vitest'

import { SpatialCollisionInputAdapter } from '../../spatial/SpatialCollisionInputAdapter'
import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import { BALLOON_RALLY_RULES } from './BalloonRallyCore'
import { BalloonRallySession } from './BalloonRallySession'

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
  it('continues through the first 1.5 seconds of active tracking degradation, then freezes safely', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 2 })
    await session.start()
    spatialInput.ingest(spatial(1, null, null), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, true)

    session.tick(1_400, false)
    expect(session.getState().elapsedMs).toBe(1_400)
    expect(session.getPresentationSnapshot().trackingState).toBe('DEGRADED')

    session.tick(200, false)
    expect(session.getState().elapsedMs).toBe(1_500)
    expect(session.getPresentationSnapshot().trackingState).toBe('SOFT_RECOVERY')
    const softFrozen = session.getState()
    session.tick(1_600, false)
    expect(session.getState()).toEqual(softFrozen)
    expect(session.getPresentationSnapshot().trackingState).toBe('HARD_PAUSE')
    await session.stop()
  })

  it('allows an available right hand to score while the left hand is unavailable and torso tracking stays useful', async () => {
    const spatialInput = new SpatialCollisionInputAdapter()
    const session = new BalloonRallySession(spatialInput, { seed: 21 })
    await session.start()
    spatialInput.ingest(spatial(1, null, null), GEOMETRY)
    session.tick(BALLOON_RALLY_RULES.countdownMs, {
      setupReady: true,
      usefulTracking: true,
      hardFailure: false,
    })
    const balloon = session.getState().balloons[0]
    const point = {
      x: 1 - (balloon?.x ?? 640) / 1280,
      y: (balloon?.y ?? 360) / 720,
    }
    spatialInput.ingest(spatial(2, null, point), GEOMETRY)
    session.tick(0, { setupReady: true, usefulTracking: true, hardFailure: false })

    expect(session.getState()).toMatchObject({ hits: 1, score: 1 })
    expect(session.getPresentationSnapshot().trackingState).toBe('NORMAL')
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

    session.tick(1_500, false)
    const beforePause = session.getState()
    session.tick(1, false)
    expect(session.getState()).toEqual(beforePause)

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
})
