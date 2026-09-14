import { describe, expect, it } from 'vitest'

import {
  TENNIS_RULES,
  advanceTennis,
  createTennisState,
  replayTennis,
  type TennisState,
  type TennisSwingAttempt,
} from './TennisCore'

function playingState(seed = 0x54454e4e): TennisState {
  return advanceTennis(createTennisState({ seed }), { deltaMs: TENNIS_RULES.countdownMs })
}

function moveTo(state: TennisState, timestampMs: number): TennisState {
  return advanceTennis(state, { deltaMs: Math.max(0, timestampMs - state.elapsedMs) })
}

function attemptAt(
  timestampMs: number,
  overrides: Partial<TennisSwingAttempt> = {},
): TennisSwingAttempt {
  return {
    hand: 'LEFT',
    timestampMs,
    vectorX: 0.8,
    vectorY: 0.1,
    intensity: 0.75,
    sequence: 1,
    ...overrides,
  }
}

describe('TennisCore deterministic course', () => {
  it('reproduces the same seeded shot schedule and replay schedule', () => {
    const first = createTennisState({ seed: 12345 })
    const second = createTennisState({ seed: 12345 })
    const replay = replayTennis(first)

    expect(second.shots).toEqual(first.shots)
    expect(replay.shots).toEqual(first.shots)
    expect(first.shots.map(({ type, targetTimeMs, incomingSide }) => ({ type, targetTimeMs, incomingSide })))
      .toEqual(second.shots.map(({ type, targetTimeMs, incomingSide }) => ({ type, targetTimeMs, incomingSide })))
  })

  it('does not depend on Math.random for gameplay', () => {
    const random = Math.random
    Math.random = () => { throw new Error('Math.random is not allowed in TennisCore') }
    try {
      expect(() => createTennisState({ seed: 9 })).not.toThrow()
    } finally {
      Math.random = random
    }
  })

  it('starts with NORMAL warm-up shots and introduces all shot families after warm-up', () => {
    const state = createTennisState({ seed: 7 })
    const warmUp = state.shots.filter((shot) => shot.targetTimeMs < TENNIS_RULES.warmUpEndMs)
    const later = state.shots.filter((shot) => shot.targetTimeMs >= TENNIS_RULES.warmUpEndMs)

    expect(warmUp.length).toBeGreaterThan(0)
    expect(warmUp.every((shot) => shot.type === 'NORMAL')).toBe(true)
    expect(new Set(later.map((shot) => shot.type))).toEqual(new Set(['NORMAL', 'FAST', 'LOB']))
  })

  it('uses the exact legal spacing per phase and keeps targets inside the round', () => {
    const state = createTennisState({ seed: 44 })
    expect(TENNIS_RULES.warmUpSpacingMs).toBe(2200)
    expect(TENNIS_RULES.rallySpacingMs).toBe(1900)
    expect(TENNIS_RULES.pressureSpacingMs).toBe(1650)
    expect(TENNIS_RULES.matchRushSpacingMs).toBe(1450)

    expect(state.shots.every((shot) => shot.targetTimeMs >= 0 && shot.targetTimeMs <= TENNIS_RULES.roundMs)).toBe(true)
    expect(state.shots.every((shot, index) => index === 0 || shot.targetTimeMs > state.shots[index - 1]!.targetTimeMs)).toBe(true)
    expect(state.shots.some((shot) => shot.targetTimeMs >= TENNIS_RULES.matchRushStartMs)).toBe(true)
    for (let index = 1; index < state.shots.length; index += 1) {
      expect(state.shots[index]!.targetTimeMs - state.shots[index - 1]!.targetTimeMs)
        .toBeGreaterThanOrEqual(TENNIS_RULES.minimumShotSpacingMs)
    }
  })
})

describe('TennisCore contact and trajectory', () => {
  it.each([
    ['PERFECT', 0, 150],
    ['PERFECT', 140, 150],
    ['PERFECT', -140, 150],
    ['GREAT', 141, 120],
    ['GREAT', -280, 120],
    ['GOOD', 281, 90],
    ['GOOD', -450, 90],
  ] as const)('grades %s at offset %d ms', (grade, offsetMs, baseScore) => {
    const state = playingState()
    const target = state.shots[0]!.targetTimeMs
    const atTime = moveTo(state, target + offsetMs)
    const result = advanceTennis(atTime, {
      deltaMs: 0,
      swingAttempts: [attemptAt(target + offsetMs)],
    }).lastResult

    expect(result?.resolution).toBe(grade)
    expect(result?.scoreAward).toBe(baseScore + 30)
  })

  it('does not resolve a swing earlier than the symmetric contact window', () => {
    const state = playingState()
    const target = state.shots[0]!.targetTimeMs
    const early = moveTo(state, target - TENNIS_RULES.goodWindowMs - 1)
    const result = advanceTennis(early, {
      deltaMs: 0,
      swingAttempts: [attemptAt(target - TENNIS_RULES.goodWindowMs - 1)],
    })

    expect(result.returns).toBe(0)
    expect(result.shots[0]!.resolution).toBe('PENDING')
  })

  it('resolves only one ball per swing and chooses the nearest eligible ball', () => {
    const state = playingState()
    const first = state.shots[0]!
    const second = state.shots[1]!
    const overlapping = {
      ...state,
      elapsedMs: 5_000,
      roundRemainingMs: TENNIS_RULES.roundMs - 5_000,
      shots: [
        { ...first, targetTimeMs: 4_900 },
        { ...second, targetTimeMs: 5_200 },
      ],
    } as TennisState
    const result = advanceTennis(overlapping, {
      deltaMs: 0,
      swingAttempts: [attemptAt(5_000)],
    })

    expect(result.returns).toBe(1)
    expect(result.shots.filter((shot) => shot.resolution !== 'PENDING')).toHaveLength(1)
    expect(result.shots.find((shot) => shot.id === first.id)?.resolution).toBe('PERFECT')
  })

  it('lets either anatomical hand return either visual incoming side', () => {
    const state = playingState()
    const shot = state.shots[0]!
    const hit = advanceTennis(moveTo(state, shot.targetTimeMs), {
      deltaMs: 0,
      swingAttempts: [attemptAt(shot.targetTimeMs, { hand: 'RIGHT', vectorX: -0.9 })],
    })

    expect(hit.returns).toBe(1)
    expect(hit.lastReturn?.hand).toBe('RIGHT')
    expect(hit.lastReturn?.returnDirection).toBe('LEFT')
  })

  it('uses vector direction cosmetically and clamps intensity-derived power', () => {
    const state = playingState()
    const target = state.shots[0]!.targetTimeMs
    const low = advanceTennis(moveTo(state, target), {
      deltaMs: 0,
      swingAttempts: [attemptAt(target, { intensity: 0, vectorX: 0, vectorY: 1 })],
    })
    expect(low.lastReturn).toMatchObject({ powerBonus: 0, returnDirection: 'CENTER' })

    const secondTarget = low.shots[1]!.targetTimeMs
    const high = advanceTennis(moveTo(low, secondTarget), {
      deltaMs: 0,
      swingAttempts: [attemptAt(secondTarget, { intensity: 1, vectorX: 3, vectorY: -3 })],
    })
    expect(high.lastReturn?.powerBonus).toBe(40)
    expect(high.lastReturn?.returnDirection).toBe('RIGHT')
    expect(high.lastReturn?.returnArc).toBeGreaterThanOrEqual(-0.75)
    expect(high.lastReturn?.returnArc).toBeLessThanOrEqual(0.75)

    const bounded = advanceTennis(moveTo(high, high.shots[2]!.targetTimeMs), {
      deltaMs: 0,
      swingAttempts: [attemptAt(high.shots[2]!.targetTimeMs, { intensity: 4 })],
    })
    expect(bounded.lastReturn?.powerBonus).toBe(40)
  })
})

describe('TennisCore scoring and round lifecycle', () => {
  it('awards grade base, power bonus, and five-success rally tiers', () => {
    let state = playingState()
    for (let index = 0; index < 5; index += 1) {
      const shot = state.shots[index]!
      state = advanceTennis(moveTo(state, shot.targetTimeMs), {
        deltaMs: 0,
        swingAttempts: [attemptAt(shot.targetTimeMs, { intensity: 0 })],
      })
    }

    expect(state.score).toBe(5 * 150 + 10)
    expect(state.currentRally).toBe(5)
    expect(state.bestRally).toBe(5)
  })

  it('caps rally bonus at 50 and resets the current rally on a miss', () => {
    let state = playingState()
    for (let index = 0; index < 25; index += 1) {
      const shot = state.shots[index]!
      state = advanceTennis(moveTo(state, shot.targetTimeMs), {
        deltaMs: 0,
        swingAttempts: [attemptAt(shot.targetTimeMs, { intensity: 1 })],
      })
    }
    expect(state.currentRally).toBe(25)
    expect(state.bestRally).toBe(25)
    expect(state.lastReturn?.rallyBonus).toBe(50)
    expect(state.shots.filter((shot) => shot.resolution === 'PENDING').length).toBeGreaterThan(0)

    const nextShot = state.shots.find((shot) => shot.resolution === 'PENDING')!
    const missed = advanceTennis(moveTo(state, nextShot.targetTimeMs + TENNIS_RULES.goodWindowMs + 1), { deltaMs: 0 })
    expect(missed.currentRally).toBe(0)
    expect(missed.misses).toBeGreaterThan(0)
    expect(missed.score).toBeGreaterThanOrEqual(0)
  })

  it('transitions countdown, phases, match rush, and finishes exactly at 60 seconds', () => {
    let state = createTennisState({ seed: 5 })
    state = advanceTennis(state, { deltaMs: 1_000 })
    expect(state.phase).toBe('COUNTDOWN')
    expect(state.elapsedMs).toBe(0)
    state = advanceTennis(state, { deltaMs: 2_000 })
    expect(state.phase).toBe('PLAYING')
    expect(state.tennisPhase).toBe('WARM_UP')
    state = advanceTennis(state, { deltaMs: 15_000 })
    expect(state.elapsedMs).toBe(15_000)
    expect(state.tennisPhase).toBe('RALLY')
    state = advanceTennis(state, { deltaMs: 20_000 })
    expect(state.tennisPhase).toBe('PRESSURE')
    state = advanceTennis(state, { deltaMs: 15_000 })
    expect(state.elapsedMs).toBe(TENNIS_RULES.matchRushStartMs)
    expect(state.tennisPhase).toBe('MATCH_RUSH')
    state = advanceTennis(state, { deltaMs: 10_000 })
    expect(state.phase).toBe('FINISHED')
    expect(state.elapsedMs).toBe(TENNIS_RULES.roundMs)
    expect(state.roundRemainingMs).toBe(0)
    expect(state.presentationEvents.some((event) => event.kind === 'MATCH_RUSH_START')).toBe(true)
    expect(state.presentationEvents.some((event) => event.kind === 'ROUND_FINISH')).toBe(true)
    expect(advanceTennis(state, { deltaMs: 999 })).toEqual(state)
  })
})
