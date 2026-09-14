import { describe, expect, it } from 'vitest'

import {
  BASEBALL_RULES,
  advanceBaseball,
  baseballContactQuality,
  baseballFieldDirection,
  baseballHitPower,
  baseballLaunchArc,
  baseballStreakBonus,
  classifyBaseballHit,
  createBaseballState,
  replayBaseball,
  type BaseballState,
  type BaseballSwingAttempt,
} from './BaseballCore'

function playingState(seed = 0x42415345): BaseballState {
  return advanceBaseball(createBaseballState({ seed }), {
    deltaMs: BASEBALL_RULES.countdownMs,
  })
}

function moveTo(state: BaseballState, timestampMs: number): BaseballState {
  return advanceBaseball(state, {
    deltaMs: Math.max(0, timestampMs - state.elapsedMs),
  })
}

function attemptAt(
  timestampMs: number,
  overrides: Partial<BaseballSwingAttempt> = {},
): BaseballSwingAttempt {
  return {
    hand: 'LEFT',
    timestampMs,
    vectorX: 0,
    vectorY: 0,
    intensity: 0.5,
    sequence: 1,
    ...overrides,
  }
}

function hitFirst(
  offsetMs: number,
  overrides: Partial<BaseballSwingAttempt> = {},
): BaseballState {
  const state = playingState()
  const target = state.pitches[0]!.targetTimeMs
  return advanceBaseball(moveTo(state, target + offsetMs), {
    deltaMs: 0,
    swingAttempts: [attemptAt(target + offsetMs, overrides)],
  })
}

describe('BaseballCore deterministic pitch schedule', () => {
  it('reproduces type, zone, and target times for the same seed and replay', () => {
    const first = createBaseballState({ seed: 12345 })
    const second = createBaseballState({ seed: 12345 })
    const replay = replayBaseball(first)

    expect(second.pitches).toEqual(first.pitches)
    expect(replay.pitches).toEqual(first.pitches)
    expect(first.pitches.map(({ type, targetZone, targetTimeMs }) => ({
      type,
      targetZone,
      targetTimeMs,
    }))).toEqual(second.pitches.map(({ type, targetZone, targetTimeMs }) => ({
      type,
      targetZone,
      targetTimeMs,
    })))
  })

  it('does not use Math.random', () => {
    const random = Math.random
    Math.random = () => { throw new Error('Math.random is not allowed in BaseballCore') }
    try {
      expect(() => createBaseballState({ seed: 9 })).not.toThrow()
    } finally {
      Math.random = random
    }
  })

  it('teaches FASTBALL in warm-up and introduces every pitch family later', () => {
    const state = createBaseballState({ seed: 7 })
    const warmUp = state.pitches.filter((pitch) => pitch.targetTimeMs < 15_000)
    const later = state.pitches.filter((pitch) => pitch.targetTimeMs >= 15_000)

    expect(warmUp.length).toBeGreaterThan(0)
    expect(warmUp.every((pitch) => pitch.type === 'FASTBALL')).toBe(true)
    expect(new Set(later.map((pitch) => pitch.type))).toEqual(
      new Set(['FASTBALL', 'CURVEBALL', 'CHANGEUP']),
    )
    expect(new Set(state.pitches.map((pitch) => pitch.targetZone))).toEqual(
      new Set(['HIGH', 'CENTER', 'LOW']),
    )
  })

  it('uses exact phase spacing, never overlaps, and stays inside 60 seconds', () => {
    const state = createBaseballState({ seed: 44 })
    expect(BASEBALL_RULES.warmUpSpacingMs).toBe(3_000)
    expect(BASEBALL_RULES.battingSpacingMs).toBe(2_600)
    expect(BASEBALL_RULES.powerInningSpacingMs).toBe(2_300)
    expect(BASEBALL_RULES.homeRunRushSpacingMs).toBe(2_000)

    expect(state.pitches.every((pitch) => pitch.targetTimeMs < 60_000)).toBe(true)
    for (let index = 1; index < state.pitches.length; index += 1) {
      const spacing = state.pitches[index]!.targetTimeMs - state.pitches[index - 1]!.targetTimeMs
      const previousTarget = state.pitches[index - 1]!.targetTimeMs
      const expectedSpacing = previousTarget >= 50_000
        ? 2_000
        : previousTarget >= 35_000
          ? 2_300
          : previousTarget >= 15_000
            ? 2_600
            : 3_000
      expect(spacing).toBe(expectedSpacing)
      expect(spacing).toBeGreaterThanOrEqual(2_000)
      expect(spacing).toBeGreaterThan(0)
    }
  })
})

describe('BaseballCore contact timing', () => {
  it.each([
    ['PERFECT', 0],
    ['PERFECT', 120],
    ['PERFECT', -120],
    ['GREAT', 121],
    ['GREAT', -240],
    ['GOOD', 241],
    ['GOOD', -380],
  ] as const)('grades %s at offset %d ms', (grade, offsetMs) => {
    expect(hitFirst(offsetMs).lastHit?.grade).toBe(grade)
  })

  it('ignores too-early swings and marks a pending pitch MISS after the late edge', () => {
    const state = playingState()
    const target = state.pitches[0]!.targetTimeMs
    const early = advanceBaseball(moveTo(state, target - 381), {
      deltaMs: 0,
      swingAttempts: [attemptAt(target - 381)],
    })
    expect(early.pitches[0]!.resolution).toBe('PENDING')

    const late = moveTo(early, target + 381)
    expect(late.pitches[0]!.resolution).toBe('MISS')
    expect(late.misses).toBe(1)
  })

  it('resolves at most one nearest eligible pitch per swing', () => {
    const state = playingState()
    const overlapping = {
      ...state,
      elapsedMs: 5_000,
      roundRemainingMs: 55_000,
      pitches: [
        { ...state.pitches[0]!, targetTimeMs: 4_900 },
        { ...state.pitches[1]!, targetTimeMs: 5_200 },
      ],
    } as BaseballState
    const result = advanceBaseball(overlapping, {
      deltaMs: 0,
      swingAttempts: [attemptAt(5_000)],
    })

    expect(result.hits).toBe(1)
    expect(result.pitches.filter((pitch) => pitch.resolution !== 'PENDING')).toHaveLength(1)
    expect(result.pitches[0]!.resolution).toBe('PERFECT')
  })

  it('allows either hand, every target zone, zero intensity, and any vector to make timed contact', () => {
    for (const hand of ['LEFT', 'RIGHT'] as const) {
      const hit = hitFirst(0, {
        hand,
        intensity: -5,
        vectorX: hand === 'LEFT' ? 50 : -50,
        vectorY: 50,
      })
      expect(hit.hits).toBe(1)
      expect(hit.lastHit?.hand).toBe(hand)
      expect(hit.lastHit?.hitPower).toBe(0.55)
    }
  })
})

describe('BaseballCore game-local hit result', () => {
  it('maps hit power exactly from bounded intensity', () => {
    expect(baseballHitPower(-1)).toBe(0.55)
    expect(baseballHitPower(0.5)).toBeCloseTo(0.775, 10)
    expect(baseballHitPower(2)).toBe(1)
  })

  it('uses exact field thresholds without gating contact', () => {
    expect(baseballFieldDirection(-1)).toBe('LEFT_FIELD')
    expect(baseballFieldDirection(-0.25)).toBe('CENTER_FIELD')
    expect(baseballFieldDirection(0.25)).toBe('CENTER_FIELD')
    expect(baseballFieldDirection(1)).toBe('RIGHT_FIELD')
  })

  it('bounds the arcade launch arc and computes exact timing-weighted quality', () => {
    expect(baseballLaunchArc(-3)).toBe(1)
    expect(baseballLaunchArc(0)).toBe(0.5)
    expect(baseballLaunchArc(3)).toBe(0)
    expect(baseballContactQuality('PERFECT', 0.55)).toBeCloseTo(0.865, 10)
    expect(baseballContactQuality('GREAT', 1)).toBeCloseTo(0.874, 10)
    expect(baseballContactQuality('GOOD', 1)).toBeCloseTo(0.755, 10)
  })

  it('classifies exact SINGLE, DOUBLE, TRIPLE, and HOME_RUN thresholds', () => {
    expect(classifyBaseballHit(0.679, 1)).toBe('SINGLE')
    expect(classifyBaseballHit(0.68, 0)).toBe('DOUBLE')
    expect(classifyBaseballHit(0.779, 1)).toBe('DOUBLE')
    expect(classifyBaseballHit(0.78, 0)).toBe('TRIPLE')
    expect(classifyBaseballHit(0.88, 0.49)).toBe('TRIPLE')
    expect(classifyBaseballHit(0.88, 0.5)).toBe('HOME_RUN')
  })

  it('produces identical metadata for identical normalized attempts', () => {
    const first = hitFirst(0, { intensity: 0.72, vectorX: 0.7, vectorY: -0.4 })
    const second = hitFirst(0, { intensity: 0.72, vectorX: 0.7, vectorY: -0.4 })
    expect(second.lastHit).toEqual(first.lastHit)
  })
})

describe('BaseballCore scoring and round lifecycle', () => {
  it('applies exact grade, hit-result, power, and streak score components', () => {
    const homeRun = hitFirst(0, { intensity: 0.5, vectorY: 0 })
    expect(homeRun.lastHit).toMatchObject({
      grade: 'PERFECT', result: 'HOME_RUN', baseScore: 150,
      resultBonus: 300, powerBonus: 15, streakBonus: 0, scoreAwarded: 465,
    })

    const triple = hitFirst(121, { intensity: 0.4, vectorY: 0 })
    expect(triple.lastHit).toMatchObject({
      grade: 'GREAT', result: 'TRIPLE', baseScore: 120,
      resultBonus: 175, powerBonus: 12, scoreAwarded: 307,
    })

    const double = hitFirst(241, { intensity: 0.45, vectorY: 0 })
    expect(double.lastHit).toMatchObject({
      grade: 'GOOD', result: 'DOUBLE', baseScore: 90,
      resultBonus: 100, powerBonus: 14, scoreAwarded: 204,
    })

    const single = hitFirst(241, { intensity: 0, vectorY: 1 })
    expect(single.lastHit).toMatchObject({
      grade: 'GOOD', result: 'SINGLE', baseScore: 90,
      resultBonus: 50, powerBonus: 0, scoreAwarded: 140,
    })
  })

  it('awards bounded five-hit streak tiers, resets on MISS, and keeps best streak', () => {
    expect(baseballStreakBonus(4)).toBe(0)
    expect(baseballStreakBonus(5)).toBe(10)
    expect(baseballStreakBonus(25)).toBe(50)
    expect(baseballStreakBonus(100)).toBe(50)

    let state = playingState()
    for (let index = 0; index < 5; index += 1) {
      const pitch = state.pitches[index]!
      state = advanceBaseball(moveTo(state, pitch.targetTimeMs), {
        deltaMs: 0,
        swingAttempts: [attemptAt(pitch.targetTimeMs, { intensity: 0 })],
      })
    }
    expect(state.currentStreak).toBe(5)
    expect(state.bestStreak).toBe(5)
    expect(state.lastHit?.streakBonus).toBe(10)

    const next = state.pitches.find((pitch) => pitch.resolution === 'PENDING')!
    state = moveTo(state, next.targetTimeMs + 381)
    expect(state.currentStreak).toBe(0)
    expect(state.bestStreak).toBe(5)
    expect(state.score).toBeGreaterThanOrEqual(0)
  })

  it('changes phases at 15/35/50 seconds and finishes stably at exactly 60 seconds', () => {
    let state = createBaseballState({ seed: 5 })
    state = advanceBaseball(state, { deltaMs: 1_000 })
    expect(state.phase).toBe('COUNTDOWN')
    state = advanceBaseball(state, { deltaMs: 2_000 })
    expect(state.phase).toBe('PLAYING')
    expect(state.baseballPhase).toBe('WARM_UP')
    state = advanceBaseball(state, { deltaMs: 15_000 })
    expect(state.baseballPhase).toBe('BATTING')
    state = advanceBaseball(state, { deltaMs: 20_000 })
    expect(state.baseballPhase).toBe('POWER_INNING')
    state = advanceBaseball(state, { deltaMs: 15_000 })
    expect(state.elapsedMs).toBe(50_000)
    expect(state.baseballPhase).toBe('HOME_RUN_RUSH')
    state = advanceBaseball(state, { deltaMs: 10_000 })
    expect(state.phase).toBe('FINISHED')
    expect(state.elapsedMs).toBe(60_000)
    expect(state.roundRemainingMs).toBe(0)
    expect(state.pitches.every((pitch) => pitch.resolution !== 'PENDING')).toBe(true)
    expect(advanceBaseball(state, { deltaMs: 999 })).toEqual(state)
    expect(replayBaseball(state).pitches).toEqual(createBaseballState({ seed: 5 }).pitches)
  })
})
