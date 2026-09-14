import { describe, expect, it } from 'vitest'

import {
  BADMINTON_RULES,
  advanceBadminton,
  badmintonPhaseAt,
  createBadmintonState,
  replayBadminton,
  type BadmintonState,
  type BadmintonSwingAttempt,
} from './BadmintonCore'

function playingState(seed = 0x4241444d): BadmintonState {
  return advanceBadminton(createBadmintonState({ seed }), {
    deltaMs: BADMINTON_RULES.countdownMs,
  })
}

function moveTo(state: BadmintonState, timestampMs: number): BadmintonState {
  return advanceBadminton(state, { deltaMs: Math.max(0, timestampMs - state.elapsedMs) })
}

function attemptAt(
  timestampMs: number,
  overrides: Partial<BadmintonSwingAttempt> = {},
): BadmintonSwingAttempt {
  return {
    hand: 'LEFT',
    timestampMs,
    vectorX: 0.8,
    vectorY: 0,
    intensity: 0,
    sequence: 1,
    ...overrides,
  }
}

describe('BadmintonCore deterministic shuttle course', () => {
  it('reproduces the same seeded schedule and same-seed replay', () => {
    const first = createBadmintonState({ seed: 12345 })
    const second = createBadmintonState({ seed: 12345 })
    const replay = replayBadminton(first)

    expect(second.shuttles).toEqual(first.shuttles)
    expect(replay.shuttles).toEqual(first.shuttles)
    expect(first.shuttles.map(({ family, targetRegion, targetTimeMs }) => ({ family, targetRegion, targetTimeMs })))
      .toEqual(second.shuttles.map(({ family, targetRegion, targetTimeMs }) => ({ family, targetRegion, targetTimeMs })))
  })

  it('does not depend on Math.random for gameplay', () => {
    const random = Math.random
    Math.random = () => { throw new Error('Math.random is not allowed in BadmintonCore') }
    try {
      expect(() => createBadmintonState({ seed: 9 })).not.toThrow()
    } finally {
      Math.random = random
    }
  })

  it('teaches CLEAR left, CLEAR right, DRIVE, DROP before warm-up variety', () => {
    const state = createBadmintonState({ seed: 7 })
    const warmUp = state.shuttles.filter((shuttle) => shuttle.targetTimeMs < BADMINTON_RULES.warmUpEndMs)

    expect(warmUp.slice(0, 4).map((shuttle) => shuttle.family)).toEqual(['CLEAR', 'CLEAR', 'DRIVE', 'DROP'])
    expect(warmUp[0]?.targetRegion).toBe('HIGH_LEFT')
    expect(warmUp[1]?.targetRegion).toBe('HIGH_RIGHT')
    expect(warmUp.length).toBeGreaterThan(0)
  })

  it('uses exact phase spacing, deterministic target regions, and bounded target times', () => {
    const state = createBadmintonState({ seed: 44 })
    expect(BADMINTON_RULES.warmUpSpacingMs).toBe(2_000)
    expect(BADMINTON_RULES.rallySpacingMs).toBe(1_650)
    expect(BADMINTON_RULES.smashZoneSpacingMs).toBe(1_450)
    expect(BADMINTON_RULES.shuttleRushSpacingMs).toBe(1_250)
    expect(state.shuttles.every((shuttle) => shuttle.targetTimeMs > 0 && shuttle.targetTimeMs < BADMINTON_RULES.roundMs)).toBe(true)
    expect(state.shuttles.every((shuttle, index) => index === 0 || shuttle.targetTimeMs > state.shuttles[index - 1]!.targetTimeMs)).toBe(true)
    expect(state.shuttles.some((shuttle) => shuttle.targetTimeMs >= BADMINTON_RULES.shuttleRushStartMs)).toBe(true)
    for (let index = 1; index < state.shuttles.length; index += 1) {
      const previous = state.shuttles[index - 1]!
      const current = state.shuttles[index]!
      expect(current.targetTimeMs - previous.targetTimeMs).toBeGreaterThanOrEqual(BADMINTON_RULES.minimumShuttleSpacingMs)
      expect(current.targetTimeMs - previous.targetTimeMs).toBe(
        badmintonPhaseAt(previous.targetTimeMs) === 'WARM_UP'
          ? BADMINTON_RULES.warmUpSpacingMs
          : badmintonPhaseAt(previous.targetTimeMs) === 'RALLY'
            ? BADMINTON_RULES.rallySpacingMs
            : badmintonPhaseAt(previous.targetTimeMs) === 'SMASH_ZONE'
              ? BADMINTON_RULES.smashZoneSpacingMs
              : BADMINTON_RULES.shuttleRushSpacingMs,
      )
    }
  })

  it('includes all families and target regions after the warm-up', () => {
    const state = createBadmintonState({ seed: 2026 })
    const later = state.shuttles.filter((shuttle) => shuttle.targetTimeMs >= BADMINTON_RULES.warmUpEndMs)
    expect(new Set(later.map((shuttle) => shuttle.family))).toEqual(new Set(['CLEAR', 'DRIVE', 'DROP']))
    expect(new Set(later.map((shuttle) => shuttle.targetRegion))).toEqual(
      new Set(['HIGH_LEFT', 'HIGH_RIGHT', 'MID_LEFT', 'MID_RIGHT']),
    )
  })
})

describe('BadmintonCore contact and game-local return data', () => {
  it.each([
    ['PERFECT', 0, 150],
    ['PERFECT', 130, 150],
    ['PERFECT', -130, 150],
    ['GREAT', 131, 120],
    ['GREAT', -260, 120],
    ['GOOD', 261, 90],
    ['GOOD', -420, 90],
  ] as const)('grades %s at offset %d ms', (grade, offsetMs, baseScore) => {
    const state = playingState()
    const target = state.shuttles[0]!.targetTimeMs
    const atTime = moveTo(state, target + offsetMs)
    const result = advanceBadminton(atTime, {
      deltaMs: 0,
      swingAttempts: [attemptAt(target + offsetMs)],
    }).lastResult

    expect(result?.resolution).toBe(grade)
    expect(result?.scoreAward).toBe(baseScore)
  })

  it('does not resolve a swing before target minus the early edge', () => {
    const state = playingState()
    const target = state.shuttles[0]!.targetTimeMs
    const earlyTimestamp = target - BADMINTON_RULES.goodWindowMs - 1
    const early = moveTo(state, earlyTimestamp)
    const result = advanceBadminton(early, {
      deltaMs: 0,
      swingAttempts: [attemptAt(earlyTimestamp)],
    })

    expect(result.returns).toBe(0)
    expect(result.shuttles[0]!.resolution).toBe('PENDING')
  })

  it('resolves one nearest eligible shuttle for one swing', () => {
    const state = playingState()
    const first = state.shuttles[0]!
    const second = state.shuttles[1]!
    const overlapping = {
      ...state,
      elapsedMs: 5_000,
      roundRemainingMs: BADMINTON_RULES.roundMs - 5_000,
      shuttles: [
        { ...first, targetTimeMs: 4_900 },
        { ...second, targetTimeMs: 5_200 },
      ],
    } as BadmintonState
    const result = advanceBadminton(overlapping, {
      deltaMs: 0,
      swingAttempts: [attemptAt(5_000)],
    })

    expect(result.returns).toBe(1)
    expect(result.shuttles.filter((shuttle) => shuttle.resolution !== 'PENDING')).toHaveLength(1)
    expect(result.shuttles.find((shuttle) => shuttle.id === first.id)?.resolution).toBe('PERFECT')
  })

  it('lets either hand hit every visual target region without a direction gate', () => {
    let state = playingState()
    const target = state.shuttles[0]!
    state = advanceBadminton(moveTo(state, target.targetTimeMs), {
      deltaMs: 0,
      swingAttempts: [attemptAt(target.targetTimeMs, { hand: 'RIGHT', vectorX: -99, vectorY: 99 })],
    })

    expect(state.returns).toBe(1)
    expect(state.lastReturn?.hand).toBe('RIGHT')
    expect(state.lastReturn?.returnDirection).toBe('LEFT')
    expect(state.lastReturn?.returnArc).toBeLessThanOrEqual(BADMINTON_RULES.returnArcMax)
    expect(state.lastReturn?.returnArc).toBeGreaterThanOrEqual(-BADMINTON_RULES.returnArcMax)
  })

  it('maps intensity to bounded power and provides deterministic smash presentation only', () => {
    let state = playingState()
    const first = state.shuttles[0]!
    state = advanceBadminton(moveTo(state, first.targetTimeMs), {
      deltaMs: 0,
      swingAttempts: [attemptAt(first.targetTimeMs, { intensity: 0, vectorY: 0 })],
    })
    expect(state.lastReturn).toMatchObject({ powerBonus: 0, smash: false })

    const second = state.shuttles[1]!
    state = advanceBadminton(moveTo(state, second.targetTimeMs), {
      deltaMs: 0,
      swingAttempts: [attemptAt(second.targetTimeMs, { intensity: 1, vectorX: 3, vectorY: -3 })],
    })
    expect(state.lastReturn).toMatchObject({ powerBonus: 35, returnDirection: 'RIGHT', smash: true })
    expect(state.smashCount).toBe(1)
    expect(state.lastReturn?.returnArc).toBeGreaterThanOrEqual(-BADMINTON_RULES.returnArcMax)
    expect(state.lastReturn?.returnArc).toBeLessThanOrEqual(BADMINTON_RULES.returnArcMax)

    const third = state.shuttles[2]!
    state = advanceBadminton(moveTo(state, third.targetTimeMs), {
      deltaMs: 0,
      swingAttempts: [attemptAt(third.targetTimeMs, { intensity: 1, vectorY: 0 })],
    })
    expect(state.returns).toBe(3)
    expect(state.smashCount).toBe(1)
  })
})

describe('BadmintonCore scoring and round lifecycle', () => {
  it('awards base score, power, smash, and five-success rally tiers', () => {
    let state = playingState()
    for (let index = 0; index < 5; index += 1) {
      const shuttle = state.shuttles[index]!
      state = advanceBadminton(moveTo(state, shuttle.targetTimeMs), {
        deltaMs: 0,
        swingAttempts: [attemptAt(shuttle.targetTimeMs, { intensity: 0 })],
      })
    }

    expect(state.score).toBe(5 * 150 + 10)
    expect(state.currentRally).toBe(5)
    expect(state.bestRally).toBe(5)
  })

  it('caps rally bonus, resets on miss, counts both hands, and stays non-negative', () => {
    let state = playingState()
    for (let index = 0; index < 25; index += 1) {
      const shuttle = state.shuttles[index]!
      state = advanceBadminton(moveTo(state, shuttle.targetTimeMs), {
        deltaMs: 0,
        swingAttempts: [attemptAt(shuttle.targetTimeMs, {
          hand: index % 2 === 0 ? 'LEFT' : 'RIGHT',
          intensity: 1,
          vectorY: -1,
        })],
      })
    }
    expect(state.currentRally).toBe(25)
    expect(state.bestRally).toBe(25)
    expect(state.lastReturn?.rallyBonus).toBe(50)
    expect(state.leftHandReturns).toBe(13)
    expect(state.rightHandReturns).toBe(12)
    expect(state.score).toBeGreaterThanOrEqual(0)

    const next = state.shuttles.find((shuttle) => shuttle.resolution === 'PENDING')!
    const missed = advanceBadminton(moveTo(state, next.targetTimeMs + BADMINTON_RULES.goodWindowMs + 1), { deltaMs: 0 })
    expect(missed.currentRally).toBe(0)
    expect(missed.bestRally).toBe(25)
    expect(missed.misses).toBeGreaterThan(0)
    expect(missed.score).toBeGreaterThanOrEqual(0)
  })

  it('transitions countdown and phases exactly, rushes at 50 seconds, and finishes stably', () => {
    let state = createBadmintonState({ seed: 5 })
    state = advanceBadminton(state, { deltaMs: 1_000 })
    expect(state.phase).toBe('COUNTDOWN')
    expect(state.elapsedMs).toBe(0)
    state = advanceBadminton(state, { deltaMs: 2_000 })
    expect(state.phase).toBe('PLAYING')
    state = advanceBadminton(state, { deltaMs: 15_000 })
    expect(state.elapsedMs).toBe(15_000)
    expect(state.badmintonPhase).toBe('RALLY')
    state = advanceBadminton(state, { deltaMs: 20_000 })
    expect(state.badmintonPhase).toBe('SMASH_ZONE')
    state = advanceBadminton(state, { deltaMs: 15_000 })
    expect(state.elapsedMs).toBe(BADMINTON_RULES.shuttleRushStartMs)
    expect(state.badmintonPhase).toBe('SHUTTLE_RUSH')
    state = advanceBadminton(state, { deltaMs: 10_000 })
    expect(state.phase).toBe('FINISHED')
    expect(state.elapsedMs).toBe(BADMINTON_RULES.roundMs)
    expect(state.roundRemainingMs).toBe(0)
    expect(state.presentationEvents.some((event) => event.kind === 'SHUTTLE_RUSH_START')).toBe(true)
    expect(state.presentationEvents.some((event) => event.kind === 'ROUND_FINISH')).toBe(true)
    expect(advanceBadminton(state, { deltaMs: 999 })).toEqual(state)
  })
})
