import { describe, expect, it } from 'vitest'

import {
  LONG_JUMP_RULES,
  advanceLongJump,
  createLongJumpState,
  gradeForTimingOffset,
  launchQualityFor,
  replayLongJump,
  timingQualityForOffset,
  type LongJumpState,
} from './LongJumpCore'

function chargeState(): LongJumpState {
  let state = createLongJumpState({ seed: 17 })
  state = advanceLongJump(state, { deltaMs: LONG_JUMP_RULES.countdownMs + LONG_JUMP_RULES.attemptReadyMs })
  expect(state.phase).toBe('CHARGE')
  return state
}

function takeoffWindowState(): LongJumpState {
  return advanceLongJump(chargeState(), { deltaMs: LONG_JUMP_RULES.chargeMs })
}

function resolveAt(state: LongJumpState, takeoffElapsedMs: number, sequence: number): LongJumpState {
  const advanced = advanceLongJump(state, { deltaMs: takeoffElapsedMs })
  return advanceLongJump(advanced, {
    deltaMs: 0,
    input: { newJumpSequence: sequence, locomotionAvailable: false, locomotionIntensity: 0 },
  })
}

function finishAttempt(state: LongJumpState): LongJumpState {
  return advanceLongJump(state, {
    deltaMs: LONG_JUMP_RULES.flightMs + LONG_JUMP_RULES.resultMs + LONG_JUMP_RULES.transitionMs,
  })
}

describe('LongJumpCore charge and timing contract', () => {
  it('keeps state immutable and replayable with the same seed', () => {
    const state = createLongJumpState({ seed: 17 })

    expect(Object.isFrozen(state)).toBe(true)
    expect(Object.isFrozen(state.attemptResults)).toBe(true)
    expect(replayLongJump(state)).toEqual(createLongJumpState({ seed: 17 }))
  })

  it('uses the exact charge formula and freezes charge after CHARGE', () => {
    const state = chargeState()
    const moderate = advanceLongJump(state, {
      deltaMs: 1_000,
      input: { locomotionAvailable: true, locomotionIntensity: 0.5 },
    })
    expect(moderate.charge).toBeCloseTo(0.11, 8)

    const full = advanceLongJump(state, {
      deltaMs: LONG_JUMP_RULES.chargeMs,
      input: { locomotionAvailable: true, locomotionIntensity: 1 },
    })
    expect(full.charge).toBe(1)
    const frozen = advanceLongJump(full, {
      deltaMs: LONG_JUMP_RULES.takeoffWindowMs,
      input: { locomotionAvailable: true, locomotionIntensity: 1 },
    })
    expect(frozen.phase).toBe('RESULT')
    expect(frozen.charge).toBe(1)
  })

  it('does not build charge from unavailable or zero-intensity locomotion', () => {
    const state = chargeState()
    expect(advanceLongJump(state, { deltaMs: 1_000 }).charge).toBe(0)
    expect(advanceLongJump(state, {
      deltaMs: 1_000,
      input: { locomotionAvailable: false, locomotionIntensity: 1 },
    }).charge).toBe(0)
  })

  it('implements the exact takeoff quality and grade boundaries', () => {
    expect(timingQualityForOffset(0)).toBe(1)
    expect(timingQualityForOffset(300)).toBe(0.5)
    expect(timingQualityForOffset(-300)).toBe(0.5)
    expect(timingQualityForOffset(600)).toBe(0)
    expect(timingQualityForOffset(-600)).toBe(0)
    expect(timingQualityForOffset(900)).toBe(0)
    expect(gradeForTimingOffset(120)).toBe('PERFECT')
    expect(gradeForTimingOffset(-120)).toBe('PERFECT')
    expect(gradeForTimingOffset(121)).toBe('GREAT')
    expect(gradeForTimingOffset(250)).toBe('GREAT')
    expect(gradeForTimingOffset(251)).toBe('GOOD')
    expect(gradeForTimingOffset(450)).toBe('GOOD')
    expect(gradeForTimingOffset(451)).toBe('OK')
  })

  it('uses game-local charge and timing for fictional distance only', () => {
    expect(launchQualityFor(1, 1)).toBe(1)
    expect(launchQualityFor(0, 0)).toBe(0)
    expect(launchQualityFor(0.5, 0.5)).toBeCloseTo(0.5, 8)
    expect(takeoffWindowState().phase).toBe('TAKEOFF_WINDOW')
    expect(advanceLongJump(takeoffWindowState(), { deltaMs: LONG_JUMP_RULES.idealTakeoffTimeMs }).takeoffElapsedMs).toBe(1_400)

    const first = resolveAt(takeoffWindowState(), LONG_JUMP_RULES.idealTakeoffTimeMs, 1)
    const second = resolveAt(takeoffWindowState(), LONG_JUMP_RULES.idealTakeoffTimeMs, 2)
    expect(first.lastAttempt?.arcadeDistance).toBe(second.lastAttempt?.arcadeDistance)
    expect(first.lastAttempt?.timingOffsetMs).toBe(0)
    expect(first.lastAttempt?.timingQuality).toBe(1)
    expect(first.lastAttempt?.arcadeDistance).toBe(30)
  })

  it('completes exactly three attempts, carries misses forward, and stabilizes FINISHED', () => {
    let state = takeoffWindowState()
    state = advanceLongJump(state, { deltaMs: LONG_JUMP_RULES.takeoffWindowMs })
    expect(state.phase).toBe('RESULT')
    expect(state.lastAttempt?.resolution).toBe('NO_JUMP')
    expect(state.lastAttempt?.arcadeDistance).toBe(0)

    state = advanceLongJump(state, { deltaMs: LONG_JUMP_RULES.resultMs + LONG_JUMP_RULES.transitionMs })
    expect(state.phase).toBe('ATTEMPT_READY')
    expect(state.attemptIndex).toBe(1)
    state = advanceLongJump(state, { deltaMs: LONG_JUMP_RULES.attemptReadyMs + LONG_JUMP_RULES.chargeMs })
    state = resolveAt(state, 1_400, 2)
    state = finishAttempt(state)
    state = advanceLongJump(state, { deltaMs: LONG_JUMP_RULES.attemptReadyMs + LONG_JUMP_RULES.chargeMs })
    state = resolveAt(state, 1_400, 3)
    state = finishAttempt(state)

    expect(state.phase).toBe('FINISHED')
    expect(state.attemptResults).toHaveLength(3)
    expect(state.noJumpCount).toBe(1)
    expect(state.finalResult?.attempts).toBe(3)
    expect(advanceLongJump(state, { deltaMs: 99_999 })).toBe(state)
  })

  it('awards distance times ten and exact grade statistics without negative score', () => {
    let state = resolveAt(takeoffWindowState(), 1_400, 1)
    expect(state.lastAttempt).toMatchObject({ grade: 'PERFECT', arcadeDistance: 30, scoreAwarded: 300 })
    expect(state.totalScore).toBe(300)
    state = finishAttempt(state)
    state = advanceLongJump(state, { deltaMs: LONG_JUMP_RULES.attemptReadyMs + LONG_JUMP_RULES.chargeMs })
    state = resolveAt(state, 1_400, 2)
    expect(state.lastAttempt?.scoreAwarded).toBe(300)
    expect(state.totalScore).toBeGreaterThanOrEqual(0)
  })
})
