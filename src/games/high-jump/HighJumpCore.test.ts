import { describe, expect, it } from 'vitest'

import {
  HIGH_JUMP_RULES,
  advanceHighJump,
  createHighJumpState,
  gradeForTakeoff,
  replayHighJump,
  takeoffMeterValueAt,
  type HighJumpState,
} from './HighJumpCore'

function approachState(): HighJumpState {
  let state = createHighJumpState()
  state = advanceHighJump(state, { deltaMs: HIGH_JUMP_RULES.countdownMs })
  return advanceHighJump(state, { deltaMs: HIGH_JUMP_RULES.readyMs })
}

function jumpAt(state: HighJumpState, takeoffValue: number, sequence: number): HighJumpState {
  const meterMs = Math.round(takeoffValue * HIGH_JUMP_RULES.meterHalfCycleMs)
  const ready = advanceHighJump(state, { deltaMs: meterMs })
  return advanceHighJump(ready, { deltaMs: 0, input: { sequence } })
}

function completeAttempt(state: HighJumpState): HighJumpState {
  return advanceHighJump(state, {
    deltaMs:
      HIGH_JUMP_RULES.takeoffMs +
      HIGH_JUMP_RULES.flightMs +
      HIGH_JUMP_RULES.resultMs +
      HIGH_JUMP_RULES.transitionMs,
  })
}

describe('HighJumpCore timing contract', () => {
  it('keeps public state immutable and replayable', () => {
    const state = createHighJumpState({ seed: 11 })

    expect(Object.isFrozen(state)).toBe(true)
    expect(Object.isFrozen(state.presentationEvents)).toBe(true)
    expect(replayHighJump(state)).toEqual(createHighJumpState({ seed: 11 }))
  })

  it('runs the exact 2400ms 0-to-1-to-0 takeoff triangle', () => {
    let state = approachState()
    expect(state.takeoffValue).toBe(0)
    state = advanceHighJump(state, { deltaMs: 1_200 })
    expect(state.takeoffValue).toBe(1)
    expect(state.meterDirection).toBe('FALLING')
    state = advanceHighJump(state, { deltaMs: 1_200 })
    expect(state.takeoffValue).toBe(0)
    expect(state.meterDirection).toBe('RISING')
    expect(takeoffMeterValueAt(2_399)).toBeCloseTo(1 / 1_200, 8)
    expect(takeoffMeterValueAt(2_400)).toBe(0)
  })

  it('pauses the takeoff meter when Core time is not advanced', () => {
    const state = advanceHighJump(approachState(), { deltaMs: 650 })
    const paused = advanceHighJump(state, { deltaMs: 0 })

    expect(paused.takeoffValue).toBe(state.takeoffValue)
    expect(paused.takeoffMeterElapsedMs).toBe(state.takeoffMeterElapsedMs)
  })

  it('grades exact takeoff boundaries without using physical jump magnitude', () => {
    expect(gradeForTakeoff(0.9)).toBe('PERFECT')
    expect(gradeForTakeoff(0.78)).toBe('GREAT')
    expect(gradeForTakeoff(0.64)).toBe('GOOD')
    expect(gradeForTakeoff(0.639999)).toBe('OK')

    const state = jumpAt(approachState(), 0.9, 1)
    expect(state.lastAttempt).toMatchObject({
      grade: 'PERFECT',
      cleared: true,
      resolution: 'CLEAR',
      scoreAwarded: 500,
    })
  })

  it('uses exact fictional stage thresholds and keeps a just-below attempt uncleared', () => {
    let state = approachState()
    state = jumpAt(state, 0.5, 1)
    expect(state.lastAttempt?.cleared).toBe(true)

    state = completeAttempt(state)
    state = advanceHighJump(state, { deltaMs: HIGH_JUMP_RULES.readyMs })
    state = jumpAt(state, 0.579, 2)
    expect(state.stageIndex).toBe(1)
    expect(state.lastAttempt?.cleared).toBe(false)
    expect(state.lastAttempt?.scoreAwarded).toBe(80)
  })

  it('marks one jump once, times out no-jump attempts, and continues all five stages', () => {
    let state = approachState()
    state = advanceHighJump(state, { deltaMs: HIGH_JUMP_RULES.approachMs })
    expect(state.phase).toBe('RESULT')
    expect(state.lastAttempt).toMatchObject({ resolution: 'NO_JUMP', scoreAwarded: 0 })
    expect(state.noJumpCount).toBe(1)

    state = advanceHighJump(state, { deltaMs: HIGH_JUMP_RULES.resultMs + HIGH_JUMP_RULES.transitionMs })
    expect(state.phase).toBe('READY_FOR_ATTEMPT')
    expect(state.stageIndex).toBe(1)

    for (let stage = 1; stage < 5; stage += 1) {
      state = advanceHighJump(state, { deltaMs: HIGH_JUMP_RULES.readyMs })
      state = jumpAt(state, 0.9, stage + 1)
      state = completeAttempt(state)
    }

    expect(state.phase).toBe('FINISHED')
    expect(state.stageIndex).toBe(4)
    expect(state.currentStage).toBe(5)
    expect(state.barsCleared).toBe(4)
    expect(state.finalResult).toMatchObject({ barsCleared: 4, noJumpCount: 1 })
    expect(advanceHighJump(state, { deltaMs: 99_999 })).toBe(state)
  })

  it('scores grade, clear, and stage bonuses without ever going negative', () => {
    let state = approachState()
    state = jumpAt(state, 0.9, 1)
    expect(state.score).toBe(500)
    state = completeAttempt(state)

    state = advanceHighJump(state, { deltaMs: HIGH_JUMP_RULES.readyMs })
    state = jumpAt(state, 0.8, 2)
    expect(state.lastAttempt?.grade).toBe('GREAT')
    expect(state.lastAttempt?.scoreAwarded).toBe(470)
    expect(state.score).toBe(970)

    state = approachState()
    state = jumpAt(state, 0.1, 1)
    expect(state.lastAttempt?.grade).toBe('OK')
    expect(state.lastAttempt?.scoreAwarded).toBe(80)
    expect(state.score).toBeGreaterThanOrEqual(0)
  })
})
