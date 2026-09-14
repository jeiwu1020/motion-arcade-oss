import { describe, expect, it } from 'vitest'

import {
  SWIMMING_RULES,
  advanceSwimming,
  createSwimmingState,
  replaySwimming,
  swimmingAiPaceAt,
  type SwimmingInputSnapshot,
  type SwimmingState,
} from './SwimmingCore'

const IDLE: SwimmingInputSnapshot = Object.freeze({
  timestampMs: 0,
  available: true,
  propulsion: 0,
  speedMeter: 0,
})
const FULL: SwimmingInputSnapshot = Object.freeze({
  timestampMs: 0,
  available: true,
  propulsion: 1,
  speedMeter: 100,
})

function playing(seed = 21): SwimmingState {
  return advanceSwimming(createSwimmingState({ seed }), { deltaMs: SWIMMING_RULES.countdownMs, input: IDLE })
}

describe('SwimmingCore lifecycle and player progress', () => {
  it('completes the 3-second countdown over small frames and runs exactly 60 seconds', () => {
    let state = createSwimmingState({ seed: 1 })
    for (let frame = 0; frame < 60; frame += 1) state = advanceSwimming(state, { deltaMs: 50, input: IDLE })
    expect(state).toMatchObject({ phase: 'PLAYING', elapsedMs: 0, roundRemainingMs: 60_000 })
    state = advanceSwimming(state, { deltaMs: 59_999, input: IDLE })
    expect(state.phase).toBe('PLAYING')
    state = advanceSwimming(state, { deltaMs: 1, input: IDLE })
    expect(state).toMatchObject({ phase: 'FINISHED', elapsedMs: 60_000, roundRemainingMs: 0 })
    expect(advanceSwimming(state, { deltaMs: 9_000, input: FULL })).toBe(state)
  })

  it('uses exact phase boundaries and phase-scaled progress', () => {
    let state = playing()
    const idle = advanceSwimming(state, { deltaMs: 1_000, input: IDLE })
    expect(idle).toMatchObject({ playerSpeed: 0, playerProgress: 0 })
    const half = advanceSwimming(state, {
      deltaMs: 1_000,
      input: { ...FULL, propulsion: 0.5, speedMeter: 50 },
    })
    expect(half.playerSpeed).toBeCloseTo(0.59, 8)
    expect(half.playerProgress).toBeCloseTo(0.5605, 8)

    state = advanceSwimming(state, { deltaMs: 14_999, input: IDLE })
    expect(state.swimmingPhase).toBe('WARM_UP')
    state = advanceSwimming(state, { deltaMs: 1, input: IDLE })
    expect(state.swimmingPhase).toBe('CRUISE')
    state = advanceSwimming(state, { deltaMs: 20_000, input: IDLE })
    expect(state.swimmingPhase).toBe('CHASE')
    state = advanceSwimming(state, { deltaMs: 15_000, input: IDLE })
    expect(state.swimmingPhase).toBe('FINAL_SPLASH')
    expect(state.presentationEvents).toContainEqual(expect.objectContaining({ kind: 'FINAL_SPLASH_START' }))
  })

  it('counts accepted stroke presentation once and replays the same seed cleanly', () => {
    let state = playing(44)
    state = advanceSwimming(state, {
      deltaMs: 400,
      input: { ...FULL, acceptedStroke: { side: 'LEFT', sequence: 1, intensity: 0.7, vectorY: -1, alternatingStreak: 1 } },
    })
    state = advanceSwimming(state, {
      deltaMs: 400,
      input: { ...FULL, acceptedStroke: { side: 'LEFT', sequence: 1, intensity: 0.7, vectorY: -1, alternatingStreak: 1 } },
    })
    expect(state.acceptedStrokeCount).toBe(1)
    expect(state.leftStrokeCount).toBe(1)
    expect(replaySwimming(state)).toEqual(createSwimmingState({ seed: 44 }))
  })

  it('takes alternating streak state from the game-local cycle adapter', () => {
    let state = playing()
    state = advanceSwimming(state, {
      deltaMs: 400,
      input: { ...FULL, acceptedStroke: { side: 'LEFT', sequence: 1, intensity: 0.7, vectorY: 0, alternatingStreak: 4 } },
    })
    state = advanceSwimming(state, {
      deltaMs: 400,
      input: { ...FULL, acceptedStroke: { side: 'RIGHT', sequence: 2, intensity: 0.7, vectorY: 0, alternatingStreak: 1 } },
    })
    expect(state.currentAlternatingStreak).toBe(1)
    expect(state.bestAlternatingStreak).toBe(4)
  })
})

describe('SwimmingCore AI, ranking, overtakes, and scoring', () => {
  it('uses deterministic seeded monotonic AI progress with distinct personalities', () => {
    let first = playing(0x51a)
    let second = playing(0x51a)
    let previous = first.aiSwimmers.map(({ progress }) => progress)
    for (let secondIndex = 0; secondIndex < 60; secondIndex += 1) {
      first = advanceSwimming(first, { deltaMs: 1_000, input: IDLE })
      second = advanceSwimming(second, { deltaMs: 1_000, input: IDLE })
      expect(first.aiSwimmers).toEqual(second.aiSwimmers)
      first.aiSwimmers.forEach(({ progress }, index) => expect(progress).toBeGreaterThanOrEqual(previous[index] ?? 0))
      previous = first.aiSwimmers.map(({ progress }) => progress)
    }
    expect(swimmingAiPaceAt('STEADY', 20_000)).toBeCloseTo(0.62, 8)
    expect(swimmingAiPaceAt('SURGER', 22_000)).toBeGreaterThan(swimmingAiPaceAt('SURGER', 12_000))
    expect(swimmingAiPaceAt('FINISHER', 55_000)).toBeGreaterThan(swimmingAiPaceAt('FINISHER', 20_000))
  })

  it('emits each newly passed AI once, never counts losing position, and freezes result score', () => {
    let state = playing(9)
    state = advanceSwimming(state, { deltaMs: 5_000, input: IDLE })
    expect(state.playerRank).toBeGreaterThan(1)
    expect(state.overtakes).toBe(0)
    state = advanceSwimming(state, { deltaMs: 12_000, input: FULL })
    expect(state.overtakes).toBeGreaterThan(0)
    const overtakes = state.overtakes
    state = advanceSwimming(state, { deltaMs: 500, input: FULL })
    expect(state.overtakes).toBe(overtakes)
    state = advanceSwimming(state, { deltaMs: 60_000, input: IDLE })
    expect(state.score).toBe(
      Math.round(state.playerProgress * 100) + state.overtakes * 100 +
        (SWIMMING_RULES.placementBonus[state.finalPlace ?? 4] ?? 0),
    )
    expect(advanceSwimming(state, { deltaMs: 1_000, input: FULL })).toBe(state)
  })
})
