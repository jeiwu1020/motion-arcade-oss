import { describe, expect, it } from 'vitest'
import {
  BOWLING_RULES,
  ALL_BOWLING_PIN_IDS,
  advanceBowling,
  bowlingAimAt,
  createBowlingState,
  replayBowling,
  resolveBowlingPins,
  type BowlingState,
  type BowlingSwingAttempt,
} from './BowlingCore'

const attempt = (overrides: Partial<BowlingSwingAttempt> = {}): BowlingSwingAttempt => ({
  hand: 'LEFT',
  timestampMs: 0,
  vectorX: 0,
  vectorY: 0,
  intensity: 1,
  sequence: 1,
  ...overrides,
})

function enterAiming(seed = 1234): BowlingState {
  const state = advanceBowling(createBowlingState({ seed }), { deltaMs: BOWLING_RULES.countdownMs })
  expect(state.phase).toBe('AIMING')
  return state
}

function settleRoll(state: BowlingState): BowlingState {
  const rolling = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt()] })
  expect(rolling.phase).toBe('BALL_ROLLING')
  const settling = advanceBowling(rolling, { deltaMs: BOWLING_RULES.ballRollingMs })
  expect(settling.phase).toBe('PINS_SETTLING')
  return advanceBowling(settling, { deltaMs: BOWLING_RULES.pinsSettlingMs })
}

describe('BowlingCore', () => {
  it('uses a deterministic bounded triangle-wave aim sweep', () => {
    expect([0, 625, 1250, 1875, 2500].map(bowlingAimAt)).toEqual([-1, 0, 1, 0, -1])
    expect(bowlingAimAt(625)).toBe(bowlingAimAt(3125))
    for (let time = 0; time < 10_000; time += 37) {
      expect(bowlingAimAt(time)).toBeGreaterThanOrEqual(-1)
      expect(bowlingAimAt(time)).toBeLessThanOrEqual(1)
    }
  })

  it('resolves the same pin IDs for the same deterministic inputs', () => {
    const inputs = { seed: 77, effectiveAim: 0, power: 1, standingPinIds: ALL_BOWLING_PIN_IDS }
    expect(resolveBowlingPins(inputs)).toEqual(resolveBowlingPins(inputs))
    expect(resolveBowlingPins(inputs)).toEqual([...ALL_BOWLING_PIN_IDS])
    expect(resolveBowlingPins({ ...inputs, standingPinIds: [1, 3, 8] })).toEqual([1, 3, 8])
  })

  it('keeps edge and weak rolls bounded while stronger power never reduces potential', () => {
    const weakEdge = resolveBowlingPins({
      seed: 99,
      effectiveAim: 1,
      power: 0.65,
      standingPinIds: ALL_BOWLING_PIN_IDS,
    })
    const strongEdge = resolveBowlingPins({
      seed: 99,
      effectiveAim: 1,
      power: 1,
      standingPinIds: ALL_BOWLING_PIN_IDS,
    })
    expect(weakEdge.length).toBeLessThan(ALL_BOWLING_PIN_IDS.length)
    expect(strongEdge.length).toBeGreaterThanOrEqual(weakEdge.length)
    expect(weakEdge.every((id) => ALL_BOWLING_PIN_IDS.includes(id))).toBe(true)
  })

  it('maps intensity and horizontal vector locally without gating a release', () => {
    let center = enterAiming()
    center = advanceBowling(center, { deltaMs: 625 })
    const left = advanceBowling(center, {
      deltaMs: 0,
      swingAttempts: [attempt({ intensity: 0, vectorX: -4, vectorY: 7 })],
    })
    const right = advanceBowling(center, {
      deltaMs: 0,
      swingAttempts: [attempt({ intensity: 1, vectorX: 4, vectorY: -7, sequence: 2 })],
    })
    expect(left.phase).toBe('BALL_ROLLING')
    expect(right.phase).toBe('BALL_ROLLING')
    expect(left.lastRoll?.power).toBe(0.65)
    expect(right.lastRoll?.power).toBe(1)
    expect(left.lastRoll?.curveBias).toBe(-0.18)
    expect(right.lastRoll?.curveBias).toBe(0.18)
    expect(left.lastRoll?.effectiveAim).toBeGreaterThanOrEqual(-1)
    expect(right.lastRoll?.effectiveAim).toBeLessThanOrEqual(1)
    expect(left.lastRoll?.returnDirection).toBe('LEFT_CURVE')
    expect(right.lastRoll?.returnDirection).toBe('RIGHT_CURVE')
  })

  it('runs countdown, ball roll, settling, and frame transition with exact durations', () => {
    let aiming = enterAiming()
    aiming = advanceBowling(aiming, { deltaMs: 625 })
    const rolling = advanceBowling(aiming, { deltaMs: 0, swingAttempts: [attempt()] })
    expect(rolling.phase).toBe('BALL_ROLLING')
    expect(advanceBowling(rolling, { deltaMs: BOWLING_RULES.ballRollingMs - 1 }).phase).toBe('BALL_ROLLING')
    const settling = advanceBowling(rolling, { deltaMs: BOWLING_RULES.ballRollingMs })
    expect(settling.phase).toBe('PINS_SETTLING')
    expect(advanceBowling(settling, { deltaMs: BOWLING_RULES.pinsSettlingMs - 1 }).phase).toBe('PINS_SETTLING')
    expect(advanceBowling(settling, { deltaMs: BOWLING_RULES.pinsSettlingMs }).phase).toBe('FRAME_TRANSITION')
  })

  it('can strike from a centered high-power arcade release', () => {
    let state = enterAiming()
    state = advanceBowling(state, { deltaMs: 625 })
    state = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt({ intensity: 1 })] })
    state = advanceBowling(state, { deltaMs: BOWLING_RULES.ballRollingMs + BOWLING_RULES.pinsSettlingMs })
    expect(state.lastRoll?.strike).toBe(true)
    expect(state.lastRoll?.knockedPinIds).toEqual([...ALL_BOWLING_PIN_IDS])
    expect(state.score).toBe(150)
    expect(state.strikes).toBe(1)
    expect(state.phase).toBe('FRAME_TRANSITION')
  })

  it('preserves standing pins for roll two and resets them at the next frame', () => {
    let state = enterAiming()
    state = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt({ vectorX: 1, intensity: 0 })] })
    state = settleRoll(state)
    expect(state.rollInFrame).toBe(2)
    expect(state.standingPinIds.length).toBeGreaterThan(0)
    expect(state.standingPinIds.length).toBeLessThan(10)
    const rollTwo = advanceBowling(state, { deltaMs: 625 })
    state = advanceBowling(rollTwo, { deltaMs: 0, swingAttempts: [attempt({ sequence: 2, intensity: 1 })] })
    state = advanceBowling(state, { deltaMs: BOWLING_RULES.ballRollingMs + BOWLING_RULES.pinsSettlingMs })
    expect(state.phase).toBe('FRAME_TRANSITION')
    state = advanceBowling(state, { deltaMs: BOWLING_RULES.frameTransitionMs })
    expect(state.frameIndex).toBe(1)
    expect(state.rollInFrame).toBe(1)
    expect(state.standingPinIds).toEqual([...ALL_BOWLING_PIN_IDS])
  })

  it('applies spare and strike-streak bonuses without ever going negative', () => {
    let state = enterAiming()
    state = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt({ vectorX: 1, intensity: 0 })] })
    state = settleRoll(state)
    state = advanceBowling(state, { deltaMs: 625 })
    state = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt({ sequence: 2, intensity: 1 })] })
    state = advanceBowling(state, { deltaMs: BOWLING_RULES.ballRollingMs + BOWLING_RULES.pinsSettlingMs + BOWLING_RULES.frameTransitionMs })
    expect(state.lastRoll?.spare).toBe(true)
    expect(state.spares).toBe(1)
    expect(state.score).toBeGreaterThanOrEqual(25)
    expect(state.score).toBeGreaterThanOrEqual(0)
  })

  it('finishes after five frames and keeps the result stable', () => {
    let state = enterAiming()
    for (let frame = 0; frame < 5; frame += 1) {
      if (state.phase !== 'AIMING') break
      state = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt({ sequence: frame * 2 + 1, intensity: 0, vectorX: 1 })] })
      state = advanceBowling(state, { deltaMs: BOWLING_RULES.ballRollingMs + BOWLING_RULES.pinsSettlingMs })
      if (state.phase === 'AIMING') {
        state = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt({ sequence: frame * 2 + 2, intensity: 0, vectorX: 1 })] })
        state = advanceBowling(state, { deltaMs: BOWLING_RULES.ballRollingMs + BOWLING_RULES.pinsSettlingMs })
      }
      if (state.phase === 'FRAME_TRANSITION') state = advanceBowling(state, { deltaMs: BOWLING_RULES.frameTransitionMs })
    }
    expect(state.phase).toBe('FINISHED')
    expect(state.frameIndex).toBe(4)
    expect(state.result?.score).toBe(state.score)
    expect(advanceBowling(state, { deltaMs: 60_000 })).toBe(state)
  })

  it('replay resets all frame, pin, and result state with the same seed', () => {
    const original = createBowlingState({ seed: 123 })
    let state = enterAiming(123)
    state = advanceBowling(state, { deltaMs: 0, swingAttempts: [attempt()] })
    const replayed = replayBowling(state)
    expect(replayed).toEqual(original)
    expect(replayed.standingPinIds).toEqual([...ALL_BOWLING_PIN_IDS])
    expect(replayed.score).toBe(0)
  })
})
