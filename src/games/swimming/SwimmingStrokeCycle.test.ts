import { describe, expect, it } from 'vitest'

import {
  SWIMMING_CYCLE_RULES,
  acceptSwimmingStroke,
  createSwimmingStrokeCycle,
  swimmingPropulsionAt,
  type SwimmingStrokeAttempt,
} from './SwimmingStrokeCycle'

function stroke(
  side: 'LEFT' | 'RIGHT',
  timestampMs: number,
  sequence: number,
  intensity = 0.8,
  vectorY = 0,
): SwimmingStrokeAttempt {
  return { side, timestampMs, sequence, intensity, vectorX: side === 'LEFT' ? -0.8 : 0.8, vectorY }
}

describe('SwimmingStrokeCycle alternation', () => {
  it.each(['LEFT', 'RIGHT'] as const)('allows %s to be the first accepted stroke', (side) => {
    const result = acceptSwimmingStroke(createSwimmingStrokeCycle(), stroke(side, 0, 1))
    expect(result.outcome).toBe('ACCEPTED')
    expect(result.state.latestAcceptedStroke?.side).toBe(side)
    expect(result.state.expectedNextSide).toBe(side === 'LEFT' ? 'RIGHT' : 'LEFT')
  })

  it('accepts either anatomical alternating order and rejects same-side spam', () => {
    let leftFirst = createSwimmingStrokeCycle()
    for (const attempt of [stroke('LEFT', 0, 1), stroke('RIGHT', 400, 1), stroke('LEFT', 800, 2)]) {
      const result = acceptSwimmingStroke(leftFirst, attempt)
      expect(result.outcome).toBe('ACCEPTED')
      leftFirst = result.state
    }
    expect(leftFirst.acceptedStrokeCount).toBe(3)

    let rightFirst = createSwimmingStrokeCycle()
    for (const attempt of [stroke('RIGHT', 0, 1), stroke('LEFT', 400, 1), stroke('RIGHT', 800, 2)]) {
      rightFirst = acceptSwimmingStroke(rightFirst, attempt).state
    }
    expect(rightFirst.acceptedStrokeCount).toBe(3)

    const spammed = acceptSwimmingStroke(leftFirst, stroke('LEFT', 1_200, 3))
    expect(spammed.outcome).toBe('WRONG_SIDE')
    expect(spammed.state).toEqual(leftFirst)
  })

  it('enforces the inclusive 260ms minimum and restarts rhythm beyond 1800ms', () => {
    const first = acceptSwimmingStroke(createSwimmingStrokeCycle(), stroke('LEFT', 0, 1)).state
    expect(acceptSwimmingStroke(first, stroke('RIGHT', 259, 1)).outcome).toBe('TOO_SOON')

    const edge = acceptSwimmingStroke(first, stroke('RIGHT', SWIMMING_CYCLE_RULES.minimumStrokeIntervalMs, 1))
    expect(edge.outcome).toBe('ACCEPTED')
    expect(edge.state.strokeCadence).toBeCloseTo(200, 8)

    const restarted = acceptSwimmingStroke(
      first,
      stroke('RIGHT', SWIMMING_CYCLE_RULES.maximumStrokeIntervalMs + 1, 1),
    )
    expect(restarted.outcome).toBe('ACCEPTED')
    expect(restarted.state.strokeCadence).toBe(0)
    expect(restarted.state.currentAlternatingStreak).toBe(1)
  })

  it('uses vector only as bounded presentation data, never as an acceptance gate', () => {
    const accepted = acceptSwimmingStroke(
      createSwimmingStrokeCycle(),
      { ...stroke('LEFT', 0, 1, 0.8), vectorX: 99, vectorY: -99 },
    )
    expect(accepted.outcome).toBe('ACCEPTED')
    expect(accepted.state.latestAcceptedStroke).toMatchObject({ vectorX: 1, vectorY: -1 })
  })
})

describe('SwimmingStrokeCycle propulsion', () => {
  it('calculates cadence, recent intensity average, and the exact propulsion formula', () => {
    let state = createSwimmingStrokeCycle()
    state = acceptSwimmingStroke(state, stroke('LEFT', 0, 1, 0.6)).state
    state = acceptSwimmingStroke(state, stroke('RIGHT', 400, 1, 1)).state

    expect(state.strokeCadence).toBe(150)
    expect(state.recentAverageIntensity).toBe(0.8)
    expect(state.basePropulsion).toBeCloseTo(0.65 + 0.8 * 0.35, 8)
    expect(swimmingPropulsionAt(state, 400)).toBeCloseTo(0.93, 8)
  })

  it('bounds propulsion and rewards faster valid rhythm and stronger strokes', () => {
    const build = (interval: number, intensity: number) => {
      let state = createSwimmingStrokeCycle()
      state = acceptSwimmingStroke(state, stroke('LEFT', 0, 1, intensity)).state
      state = acceptSwimmingStroke(state, stroke('RIGHT', interval, 1, intensity)).state
      return swimmingPropulsionAt(state, interval)
    }
    expect(swimmingPropulsionAt(createSwimmingStrokeCycle(), 10_000)).toBe(0)
    expect(build(400, 0.7)).toBeGreaterThan(build(600, 0.7))
    expect(build(400, 1)).toBeGreaterThan(build(400, 0.2))
    expect(build(260, 1)).toBeLessThanOrEqual(1)
  })

  it('holds for 500ms then decays linearly to zero at 1500ms', () => {
    let state = createSwimmingStrokeCycle()
    state = acceptSwimmingStroke(state, stroke('LEFT', 0, 1, 1)).state
    state = acceptSwimmingStroke(state, stroke('RIGHT', 400, 1, 1)).state
    const base = state.basePropulsion
    expect(swimmingPropulsionAt(state, 900)).toBe(base)
    expect(swimmingPropulsionAt(state, 1_400)).toBeCloseTo(base / 2, 8)
    expect(swimmingPropulsionAt(state, 1_900)).toBe(0)
  })
})
