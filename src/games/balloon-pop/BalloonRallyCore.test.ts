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

  it('uses the 15 / 35 / 50 second population progression and escalates Party Rush from five to seven balloons', () => {
    let state = begin()
    state = advanceBalloonRally(state, { deltaMs: 15_000, interactionRegion: REGION, contacts: [] })
    expect(state).toMatchObject({ progression: 'RALLY', partyRush: false })
    expect(state.balloons.filter((balloon) => balloon.kind === 'STANDARD')).toHaveLength(3)

    state = advanceBalloonRally(state, { deltaMs: 20_000, interactionRegion: REGION, contacts: [] })
    expect(state).toMatchObject({ progression: 'FEVER', partyRush: false })
    expect(state.balloons.filter((balloon) => balloon.kind === 'STANDARD')).toHaveLength(4)

    state = advanceBalloonRally(state, { deltaMs: 15_000, interactionRegion: REGION, contacts: [] })
    expect(state).toMatchObject({ progression: 'PARTY_RUSH', partyRush: true, roundRemainingMs: 10_000 })
    expect(state.balloons).toHaveLength(5)
    expect(state.balloons.every((balloon) =>
      balloon.hp === 1 && balloon.maxHp === 1 && balloon.kind === 'PARTY',
    )).toBe(true)
    state = advanceBalloonRally(state, { deltaMs: 5_000, interactionRegion: REGION, contacts: [] })
    expect(state.balloons).toHaveLength(6)
    state = advanceBalloonRally(state, { deltaMs: 3_000, interactionRegion: REGION, contacts: [] })
    expect(state.balloons).toHaveLength(7)
    state = advanceBalloonRally(state, { deltaMs: 2_000, interactionRegion: REGION, contacts: [] })
    expect(state).toMatchObject({ phase: 'FINISHED', roundRemainingMs: 0 })
    expect(state.balloons).toHaveLength(7)
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

  it('makes each Party balloon one-hit, worth two base points, and immediately maintains the rush population', () => {
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

  it('uses the longer Party Rush Combo window without resetting the active Combo', () => {
    let state = begin()
    state = advanceBalloonRally(state, { deltaMs: 49_000, interactionRegion: REGION, contacts: [] })
    state = hit(state, state.balloons[0]?.id ?? -1)
    state = advanceBalloonRally(state, { deltaMs: 999, interactionRegion: REGION, contacts: [] })
    expect(state.combo).toBe(1)
    state = advanceBalloonRally(state, {
      deltaMs: 1,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(state.partyRush).toBe(true)
    expect(state.combo).toBe(1)
    state = hit(state, state.balloons[0]?.id ?? -1)
    expect(state.comboRemainingMs).toBe(BALLOON_RALLY_RULES.partyComboWindowMs)
    const stillActive = advanceBalloonRally(state, {
      deltaMs: BALLOON_RALLY_RULES.comboWindowMs + 1,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(stillActive.combo).toBeGreaterThan(0)
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

  it('schedules deterministic Golden Balloons with one-hit scoring and expiry without a penalty', () => {
    const first = begin(31)
    const second = begin(31)
    const advanced = advanceBalloonRally(first, {
      deltaMs: 12_000,
      interactionRegion: REGION,
      contacts: [],
    })
    const goldens = advanced.balloons.filter((balloon) => balloon.kind === 'GOLDEN')

    const advancedAgain = advanceBalloonRally(second, {
      deltaMs: 12_000,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(advanced.goldenNextSpawnMs).toBe(advancedAgain.goldenNextSpawnMs)
    expect(goldens).toHaveLength(1)
    expect(goldens[0]).toMatchObject({ hp: 1, maxHp: 1, radius: 68 })

    const goldenId = goldens[0]?.id ?? -1
    const popped = hit(advanced, goldenId)
    expect(popped).toMatchObject({ score: 5, hits: 1, pops: 1, combo: 1 })
    expect(popped.balloons.some((balloon) => balloon.kind === 'GOLDEN')).toBe(false)

    const expired = advanceBalloonRally(advanced, {
      deltaMs: BALLOON_RALLY_RULES.goldenLifetimeMs + 1,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(expired.score).toBe(0)
    expect(expired.pops).toBe(0)
    expect(expired.balloons.some((balloon) => balloon.kind === 'GOLDEN')).toBe(false)
  })

  it('runs two deterministic Giant moments with distinct durability, radius, value, and safe expiry', () => {
    let earlyState = begin(41)
    earlyState = advanceBalloonRally(earlyState, {
      deltaMs: BALLOON_RALLY_RULES.giantEarlySpawnMs,
      interactionRegion: REGION,
      contacts: [],
    })
    const early = earlyState.balloons.find((balloon) => balloon.kind === 'GIANT')
    expect(early).toMatchObject({ giantVariant: 1, hp: 3, maxHp: 3, radius: BALLOON_RALLY_RULES.giantEarlyRadius })
    for (let index = 0; index < 3; index += 1) earlyState = hit(earlyState, early?.id ?? -1)
    expect(earlyState).toMatchObject({ score: 6, hits: 3, pops: 1, giantsSpawned: 1 })

    const expired = advanceBalloonRally(begin(41), {
      deltaMs: BALLOON_RALLY_RULES.giantEarlyExpiryMs,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(expired.giantsSpawned).toBe(1)
    expect(expired.pops).toBe(0)
    expect(expired.balloons.some((balloon) => balloon.kind === 'GIANT')).toBe(false)

    let mainState = advanceBalloonRally(expired, {
      deltaMs: BALLOON_RALLY_RULES.giantMainSpawnMs - expired.elapsedMs,
      interactionRegion: REGION,
      contacts: [],
    })
    const main = mainState.balloons.find((balloon) => balloon.kind === 'GIANT')
    expect(main).toMatchObject({ giantVariant: 2, hp: 4, maxHp: 4, radius: BALLOON_RALLY_RULES.giantMainRadius })
    expect(mainState.balloons.filter((balloon) => balloon.kind === 'GIANT')).toHaveLength(1)
    for (let index = 0; index < 4; index += 1) mainState = hit(mainState, main?.id ?? -1)
    expect(mainState).toMatchObject({ score: 8, hits: 4, pops: 1, giantsSpawned: 2 })
    expect(mainState.balloons.some((balloon) => balloon.kind === 'GIANT')).toBe(false)

    const party = advanceBalloonRally(mainState, {
      deltaMs: BALLOON_RALLY_RULES.partyRushStartMs - mainState.elapsedMs,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(party.balloons.some((balloon) => balloon.kind === 'GIANT')).toBe(false)
  })

  it('selects exactly one deterministic mini-event and bounds event targets', () => {
    const first = begin(99)
    const second = begin(99)
    expect(first.miniEventKind).toBe(second.miniEventKind)
    expect(first.miniEventStartMs).toBeGreaterThanOrEqual(27_000)
    expect(first.miniEventStartMs).toBeLessThanOrEqual(33_000)

    const active = advanceBalloonRally(first, {
      deltaMs: first.miniEventStartMs + 1,
      interactionRegion: REGION,
      contacts: [],
    })
    expect(active.miniEventSequence).toBe(1)
    expect(active.miniEventRemainingMs).toBeGreaterThan(0)
    if (active.miniEventKind === 'GOLD_RUSH') {
      expect(active.balloons.filter((balloon) => balloon.kind === 'GOLDEN').length).toBeLessThanOrEqual(2)
      expect(active.miniEventSpawnedCount).toBeLessThanOrEqual(4)
    }
    if (active.miniEventKind === 'BALLOON_RAIN') {
      expect(active.balloons.filter((balloon) => balloon.kind === 'BONUS').length).toBeLessThanOrEqual(2)
      expect(active.miniEventSpawnedCount).toBeLessThanOrEqual(6)
    }
  })

  it('applies Score Fever to accepted hits only while the event is active', () => {
    let state = begin(2)
    state = { ...state, miniEventKind: 'SCORE_FEVER', miniEventStartMs: 1, miniEventRemainingMs: 6_000, miniEventStarted: true, miniEventSequence: 1 }
    const scored = hit(state, state.balloons[0]?.id ?? -1)
    expect(scored.score).toBe(2)
    const withoutEvent = { ...scored, miniEventKind: 'GOLD_RUSH' as const }
    expect(hit(scored, scored.balloons[0]?.id ?? -1).score - hit(withoutEvent, withoutEvent.balloons[0]?.id ?? -1).score).toBe(1)
  })

  it('preserves standard population separately from specials and cleans specials at Party Rush', () => {
    let state = begin(7)
    state = advanceBalloonRally(state, { deltaMs: 42_000, interactionRegion: REGION, contacts: [] })
    expect(state.balloons.filter((balloon) => balloon.kind === 'STANDARD')).toHaveLength(4)
    expect(state.balloons.some((balloon) => balloon.kind === 'GIANT')).toBe(true)
    state = advanceBalloonRally(state, { deltaMs: 10_000, interactionRegion: REGION, contacts: [] })
    expect(state.balloons).toHaveLength(5)
    expect(state.balloons.every((balloon) => balloon.kind === 'PARTY')).toBe(true)
  })

  it('runs Balloon Rain with two concurrent one-hit Bonus targets and removes them at event end', () => {
    let state = begin(17)
    state = {
      ...state,
      miniEventKind: 'BALLOON_RAIN',
      miniEventStartMs: 1,
    }
    state = advanceBalloonRally(state, { deltaMs: 2, interactionRegion: REGION, contacts: [] })
    expect(state.balloons.filter((balloon) => balloon.kind === 'BONUS')).toHaveLength(2)
    const bonusId = state.balloons.find((balloon) => balloon.kind === 'BONUS')?.id ?? -1
    state = hit(state, bonusId)
    expect(state).toMatchObject({ score: 2, hits: 1, pops: 1 })
    expect(state.balloons.filter((balloon) => balloon.kind === 'BONUS')).toHaveLength(2)
    state = advanceBalloonRally(state, { deltaMs: BALLOON_RALLY_RULES.miniEventDurationMs, interactionRegion: REGION, contacts: [] })
    expect(state.miniEventCompleted).toBe(true)
    expect(state.balloons.some((balloon) => balloon.kind === 'BONUS')).toBe(false)
  })

  it('keeps movement personalities seeded and all velocities bounded', () => {
    const first = begin(123)
    const second = begin(123)
    expect(first.balloons.map((balloon) => balloon.personality)).toEqual(second.balloons.map((balloon) => balloon.personality))
    expect(first.balloons.every((balloon) => Math.hypot(balloon.vx, balloon.vy) <= BALLOON_RALLY_RULES.ordinaryMaximumSpeed)).toBe(true)
  })
})
