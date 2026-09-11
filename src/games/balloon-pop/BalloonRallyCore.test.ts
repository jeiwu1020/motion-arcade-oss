import { describe, expect, it } from 'vitest'

import type { LogicalPlayfieldRect } from '../../spatial/spatialPlayfieldMapping'
import {
  advanceBalloonRally,
  BALLOON_RALLY_RULES,
  createBalloonRallyState,
  replayBalloonRally,
} from './BalloonRallyCore'

const REGION: LogicalPlayfieldRect = Object.freeze({
  x: 0,
  y: 0,
  width: 1280,
  height: 720,
})

function begin(seed = 7) {
  return advanceBalloonRally(createBalloonRallyState({ seed }), {
    deltaMs: BALLOON_RALLY_RULES.countdownMs,
    interactionRegion: REGION,
    contacts: [],
  })
}

describe('Balloon Rally core', () => {
  it('is seeded, starts with a three-second countdown, and deterministically spawns two balloons', () => {
    const first = begin(7)
    const second = begin(7)

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      phase: 'PLAYING',
      countdownRemainingMs: 0,
      roundRemainingMs: 60_000,
      elapsedMs: 0,
      score: 0,
      hits: 0,
      pops: 0,
      partyRush: false,
    })
    expect(first.balloons).toHaveLength(2)
  })

  it('progresses population at twenty and forty seconds and starts Party Rush for the final ten seconds', () => {
    let state = begin()
    state = advanceBalloonRally(state, {
      deltaMs: 20_000,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(state.balloons).toHaveLength(3)

    state = advanceBalloonRally(state, {
      deltaMs: 20_000,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(state.balloons).toHaveLength(4)

    state = advanceBalloonRally(state, {
      deltaMs: 10_000,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(state.partyRush).toBe(true)
    expect(state.roundRemainingMs).toBe(10_000)
  })

  it('scores a valid contact, removes HP, pops on the third hit, and immediately replaces the balloon', () => {
    let state = begin()
    const balloonId = state.balloons[0]?.id
    expect(balloonId).toBeDefined()

    for (let sequence = 1; sequence <= 3; sequence += 1) {
      state = advanceBalloonRally(state, {
        deltaMs: 0,
        interactionRegion: REGION,
        contacts: [{ balloonId: balloonId ?? -1, side: 'LEFT', impulse: { x: 100, y: 0 } }],
      })
    }

    expect(state).toMatchObject({ score: 5, hits: 3, pops: 1 })
    expect(state.balloons).toHaveLength(2)
    expect(state.balloons.some((balloon) => balloon.id === balloonId)).toBe(false)
  })

  it('never expires ordinary balloons and freezes active play without a valid interaction region', () => {
    const playing = begin()
    const frozen = advanceBalloonRally(playing, {
      deltaMs: 30_000,
      interactionRegion: null,
      contacts: [],
    })

    expect(frozen).toEqual(playing)
  })

  it('keeps balloons inside a reduced interaction region, rebounds, and bounds speed', () => {
    const smallRegion = { x: 200, y: 150, width: 500, height: 300 }
    const advanced = advanceBalloonRally(begin(), {
      deltaMs: 10_000,
      interactionRegion: smallRegion,
      contacts: [],
    })

    for (const balloon of advanced.balloons) {
      expect(balloon.x - balloon.radius).toBeGreaterThanOrEqual(smallRegion.x)
      expect(balloon.x + balloon.radius).toBeLessThanOrEqual(smallRegion.x + smallRegion.width)
      expect(balloon.y - balloon.radius).toBeGreaterThanOrEqual(smallRegion.y)
      expect(balloon.y + balloon.radius).toBeLessThanOrEqual(smallRegion.y + smallRegion.height)
      expect(Math.hypot(balloon.vx, balloon.vy)).toBeLessThanOrEqual(
        BALLOON_RALLY_RULES.partyRushMaximumSpeed,
      )
    }
  })

  it('reverses a balloon at the interaction boundary and keeps Party Rush speed bounded', () => {
    const playing = begin()
    const first = playing.balloons[0]
    expect(first).toBeDefined()
    const edgeState = {
      ...playing,
      balloons: [{
        ...(first ?? { id: 1, x: 68, y: 360, vx: -100, vy: 0, radius: 68, hp: 3, maxHp: 3 }),
        x: (first?.radius ?? 68) + 1,
        vx: -100,
      }],
    }
    const bounced = advanceBalloonRally(edgeState, {
      deltaMs: 100,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(bounced.balloons[0]?.vx).toBeGreaterThan(0)

    const party = advanceBalloonRally(playing, {
      deltaMs: BALLOON_RALLY_RULES.partyRushStartMs,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(party.partyRush).toBe(true)
    for (const balloon of party.balloons) {
      expect(Math.hypot(balloon.vx, balloon.vy)).toBeLessThanOrEqual(
        BALLOON_RALLY_RULES.partyRushMaximumSpeed,
      )
    }
  })

  it('finishes exactly at sixty seconds and replay returns to the same deterministic countdown', () => {
    const finished = advanceBalloonRally(begin(11), {
      deltaMs: BALLOON_RALLY_RULES.roundMs,
      interactionRegion: REGION,
      contacts: [],
    })

    expect(finished).toMatchObject({ phase: 'FINISHED', roundRemainingMs: 0 })
    expect(replayBalloonRally(finished)).toEqual(createBalloonRallyState({ seed: 11 }))
  })
})
