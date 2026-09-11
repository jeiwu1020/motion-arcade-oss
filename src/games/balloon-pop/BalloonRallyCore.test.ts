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

function hit(state: ReturnType<typeof begin>, balloonId: number) {
  return advanceBalloonRally(state, {
    deltaMs: 0,
    interactionRegion: REGION,
    contacts: [{ balloonId, side: 'LEFT', impulse: { x: 100, y: 0 } }],
  })
}

describe('Balloon Rally v2 core', () => {
  it('is seeded, starts with a three-second countdown, and deterministically spawns two Warm Up balloons', () => {
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
      combo: 0,
      bestCombo: 0,
      comboRemainingMs: 0,
      progression: 'WARM_UP',
    })
    expect(first.balloons).toHaveLength(2)
    expect(first.balloons.every((balloon) =>
      balloon.hp === 2 && balloon.maxHp === 2 && balloon.kind === 'STANDARD',
    )).toBe(true)
  })

  it('uses the 15 / 35 / 50 second population progression and converts cleanly to five Party balloons', () => {
    let state = begin()
    state = advanceBalloonRally(state, { deltaMs: 15_000, interactionRegion: REGION, contacts: [] })
    expect(state).toMatchObject({ progression: 'RALLY', partyRush: false })
    expect(state.balloons).toHaveLength(3)

    state = advanceBalloonRally(state, { deltaMs: 20_000, interactionRegion: REGION, contacts: [] })
    expect(state).toMatchObject({ progression: 'FEVER', partyRush: false })
    expect(state.balloons).toHaveLength(4)

    state = advanceBalloonRally(state, { deltaMs: 15_000, interactionRegion: REGION, contacts: [] })
    expect(state).toMatchObject({ progression: 'PARTY_RUSH', partyRush: true, roundRemainingMs: 10_000 })
    expect(state.balloons).toHaveLength(5)
    expect(state.balloons.every((balloon) =>
      balloon.hp === 1 && balloon.maxHp === 1 && balloon.kind === 'PARTY',
    )).toBe(true)
  })

  it('requires two separated valid contacts to pop a standard balloon for four base points and immediately replaces it', () => {
    let state = begin()
    const balloonId = state.balloons[0]?.id
    expect(balloonId).toBeDefined()

    state = hit(state, balloonId ?? -1)
    expect(state).toMatchObject({ score: 1, hits: 1, pops: 0, combo: 1 })
    expect(state.balloons.find((balloon) => balloon.id === balloonId)).toMatchObject({ hp: 1 })

    state = hit(state, balloonId ?? -1)
    expect(state).toMatchObject({ score: 4, hits: 2, pops: 1, combo: 2 })
    expect(state.balloons).toHaveLength(2)
    expect(state.balloons.some((balloon) => balloon.id === balloonId)).toBe(false)
  })

  it('tracks Combo in a 1.5-second active window, awards the fifth-hit bonus, and freezes Combo while no frame advances', () => {
    let state = begin()
    for (let index = 0; index < 5; index += 1) {
      state = hit(state, state.balloons[0]?.id ?? -1)
    }

    expect(state).toMatchObject({ combo: 5, bestCombo: 5, score: 10 })
    const frozen = advanceBalloonRally(state, { deltaMs: 3_000, interactionRegion: null, contacts: [] })
    expect(frozen).toEqual(state)

    const expired = advanceBalloonRally(state, {
      deltaMs: BALLOON_RALLY_RULES.comboWindowMs + 1,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(expired).toMatchObject({ combo: 0, bestCombo: 5, comboRemainingMs: 0 })
  })

  it('makes each Party balloon one-hit, worth two base points, and immediately maintains five targets', () => {
    let state = begin()
    state = advanceBalloonRally(state, {
      deltaMs: BALLOON_RALLY_RULES.partyRushStartMs,
      interactionRegion: REGION,
      contacts: [],
    })
    const balloonId = state.balloons[0]?.id ?? -1
    state = hit(state, balloonId)

    expect(state).toMatchObject({ score: 2, hits: 1, pops: 1, partyRush: true })
    expect(state.balloons).toHaveLength(5)
    expect(state.balloons.every((balloon) =>
      balloon.hp === 1 && balloon.maxHp === 1 && balloon.kind === 'PARTY',
    )).toBe(true)
  })

  it('never expires balloons, safely recovers them into resized bounds, applies bounded anti-corner steering, and caps speed', () => {
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
