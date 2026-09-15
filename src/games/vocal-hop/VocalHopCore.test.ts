import { describe, expect, it } from 'vitest'

import {
  VOCAL_HOP_RULES,
  advanceVocalHop,
  createVocalHopState,
  generateVocalHopCourse,
  vocalHopLiftLevel,
} from './VocalHopCore'

describe('Vocal Hop Core', () => {
  it('shapes voice level with a comfortable saturating curve', () => {
    expect(vocalHopLiftLevel(0.1)).toBe(0)
    expect(vocalHopLiftLevel(0.55)).toBe(1)
    expect(vocalHopLiftLevel(1)).toBe(1)
    expect(vocalHopLiftLevel(0.325)).toBeCloseTo(Math.sqrt(0.5), 8)
    expect(vocalHopLiftLevel(Number.NaN)).toBe(0)
  })

  it('starts in countdown and reaches playing after three seconds', () => {
    let state = createVocalHopState({ seed: 7 })
    expect(state.phase).toBe('COUNTDOWN')
    state = advanceVocalHop(state, { deltaMs: 1_000 })
    expect(state.phase).toBe('COUNTDOWN')
    state = advanceVocalHop(state, { deltaMs: 2_000 })
    expect(state.phase).toBe('PLAYING')
    expect(state.gamePhase).toBe('WARM_UP')
  })

  it('launches one hop, applies only bounded early boost, then lands', () => {
    let state = createVocalHopState({ seed: 9 })
    state = advanceVocalHop(state, { deltaMs: VOCAL_HOP_RULES.countdownMs })
    state = advanceVocalHop(state, {
      deltaMs: 16,
      input: { triggerSequence: 1, liftLevel: 0.5, sustainedDurationSeconds: 0 },
    })
    expect(state.hopState).toBe('AIRBORNE')
    const boosted = advanceVocalHop(state, {
      deltaMs: VOCAL_HOP_RULES.boostWindowMs,
      input: { liftLevel: 1, sustainedDurationSeconds: 0 },
    })
    const afterWindow = advanceVocalHop(boosted, {
      deltaMs: VOCAL_HOP_RULES.boostWindowMs,
      input: { liftLevel: 1, sustainedDurationSeconds: 4 },
    })
    expect(afterWindow.boostElapsedMs).toBeGreaterThanOrEqual(VOCAL_HOP_RULES.boostWindowMs)
    expect(afterWindow.verticalPosition).toBeLessThan(0)
    let landed = afterWindow
    for (let i = 0; i < 12 && landed.hopState !== 'GROUNDED'; i += 1) {
      landed = advanceVocalHop(landed, { deltaMs: 100, input: { liftLevel: 1, sustainedDurationSeconds: 4 } })
    }
    expect(landed.hopState).toBe('GROUNDED')
    expect(landed.verticalPosition).toBe(0)
  })

  it('does not stack a second trigger while airborne', () => {
    let state = createVocalHopState({ seed: 3 })
    state = advanceVocalHop(state, { deltaMs: 3_000 })
    state = advanceVocalHop(state, { deltaMs: 10, input: { triggerSequence: 1, liftLevel: 0, sustainedDurationSeconds: 0 } })
    const velocity = state.verticalVelocity
    state = advanceVocalHop(state, { deltaMs: 10, input: { triggerSequence: 2, liftLevel: 0, sustainedDurationSeconds: 0 } })
    expect(state.verticalVelocity).toBeGreaterThan(velocity)
    expect(state.lastConsumedTriggerSequence).toBe(2)
  })

  it('generates a deterministic fair course with a teaching warm-up', () => {
    const first = generateVocalHopCourse(123)
    const second = generateVocalHopCourse(123)
    expect(first).toEqual(second)
    expect(first.slice(0, 4).map((obstacle) => obstacle.type)).toEqual([
      'LOW_BLOCK', 'LOW_BLOCK', 'GAP', 'HIGH_BLOCK',
    ])
    expect(first[0]?.optional).toBe(false)
    expect(first.every((obstacle) => obstacle.targetTimeMs > 0 && obstacle.targetTimeMs < VOCAL_HOP_RULES.roundMs)).toBe(true)
    expect(first.every((obstacle, index) => index === 0 || obstacle.targetTimeMs - first[index - 1]!.targetTimeMs >= VOCAL_HOP_RULES.minimumObstacleSpacingMs)).toBe(true)
    expect(first.some((obstacle) => obstacle.type === 'STAR_GATE')).toBe(true)
  })

  it('transitions phases and finishes at exactly sixty seconds', () => {
    let state = createVocalHopState({ seed: 4 })
    state = advanceVocalHop(state, { deltaMs: 3_000 + 15_000 })
    expect(state.gamePhase).toBe('HOP_RUN')
    state = advanceVocalHop(state, { deltaMs: 20_000 })
    expect(state.gamePhase).toBe('SKY_PATH')
    state = advanceVocalHop(state, { deltaMs: 15_000 })
    expect(state.gamePhase).toBe('FINAL_HOP')
    state = advanceVocalHop(state, { deltaMs: 10_000 })
    expect(state.phase).toBe('FINISHED')
    expect(state.elapsedMs).toBe(VOCAL_HOP_RULES.roundMs)
    expect(advanceVocalHop(state, { deltaMs: 100 })).toBe(state)
  })

  it('scores required clears and resets streak on a stumble without negative score', () => {
    let state = createVocalHopState({ seed: 1 })
    state = advanceVocalHop(state, { deltaMs: 3_000 })
    const firstObstacle = state.course[0]!
    state = advanceVocalHop(state, { deltaMs: firstObstacle.targetTimeMs - 400 })
    state = advanceVocalHop(state, {
      deltaMs: 400,
      input: { triggerSequence: 1, liftLevel: 0.4, sustainedDurationSeconds: 0 },
    })
    expect(state.requiredClears).toBeGreaterThanOrEqual(1)
    expect(state.score).toBeGreaterThanOrEqual(100)
    let miss = createVocalHopState({ seed: 1 })
    miss = advanceVocalHop(miss, { deltaMs: 3_000 + firstObstacle.targetTimeMs + 100 })
    expect(miss.stumbles).toBeGreaterThanOrEqual(1)
    expect(miss.score).toBe(0)
    expect(miss.currentStreak).toBe(0)
  })
})
