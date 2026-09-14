import { describe, expect, it } from 'vitest'

import {
  RUNNING_RACE_RULES,
  advanceRunningRace,
  createRunningRaceState,
  replayRunningRace,
  type RunningInputSnapshot,
  type RunningRaceState,
} from './RunningRaceCore'

const IDLE_INPUT: RunningInputSnapshot = Object.freeze({
  timestampMs: 0,
  available: false,
  intensity: 0,
  speedMeter: 0,
})

const FULL_INPUT: RunningInputSnapshot = Object.freeze({
  timestampMs: 0,
  available: true,
  intensity: 1,
  speedMeter: 100,
})

function startPlaying(seed = 17): RunningRaceState {
  return advanceRunningRace(createRunningRaceState({ seed }), {
    deltaMs: RUNNING_RACE_RULES.countdownMs,
    input: IDLE_INPUT,
  })
}

describe('RunningRaceCore lifecycle and player progress', () => {
  it('starts with a three-second countdown and completes it over small frames', () => {
    let state = createRunningRaceState({ seed: 12 })
    expect(state).toMatchObject({
      phase: 'COUNTDOWN',
      racePhase: 'START',
      countdownRemainingMs: 3_000,
      roundRemainingMs: 60_000,
      playerProgress: 0,
    })

    for (let index = 0; index < 60; index += 1) {
      state = advanceRunningRace(state, { deltaMs: 50, input: IDLE_INPUT })
    }
    expect(state.phase).toBe('PLAYING')
    expect(state.countdownRemainingMs).toBe(0)
    expect(state.elapsedMs).toBe(0)
    expect(state.roundRemainingMs).toBe(60_000)
  })

  it('uses the bounded idle epsilon and exact phase-scaled arcade progress formula', () => {
    const playing = startPlaying()
    const idle = advanceRunningRace(playing, { deltaMs: 1_000, input: IDLE_INPUT })
    expect(idle.playerSpeed).toBe(0)
    expect(idle.playerProgress).toBe(0)

    const half = advanceRunningRace(playing, {
      deltaMs: 1_000,
      input: { ...IDLE_INPUT, available: true, intensity: 0.5, speedMeter: 50 },
    })
    expect(half.playerSpeed).toBeCloseTo(0.6, 6)
    expect(half.playerProgress).toBeCloseTo(0.57, 6)

    const full = advanceRunningRace(playing, { deltaMs: 1_000, input: FULL_INPUT })
    expect(full.playerSpeed).toBe(1)
    expect(full.playerProgress).toBeCloseTo(0.95, 6)
    expect(full.speedMeter).toBe(100)
  })

  it('transitions START, PACE, CHASE, and FINAL_SPRINT at 10, 30, and 50 seconds', () => {
    let state = startPlaying()
    state = advanceRunningRace(state, { deltaMs: 9_999, input: IDLE_INPUT })
    expect(state.racePhase).toBe('START')
    state = advanceRunningRace(state, { deltaMs: 1, input: IDLE_INPUT })
    expect(state.racePhase).toBe('PACE')
    state = advanceRunningRace(state, { deltaMs: 20_000, input: IDLE_INPUT })
    expect(state.racePhase).toBe('CHASE')
    state = advanceRunningRace(state, { deltaMs: 20_000, input: IDLE_INPUT })
    expect(state.racePhase).toBe('FINAL_SPRINT')
    expect(state.presentationEvents).toContainEqual(expect.objectContaining({ kind: 'FINAL_SPRINT_START' }))
  })
})

describe('RunningRaceCore deterministic AI and ranking', () => {
  it('reproduces deterministic AI progress and keeps every AI progress monotonic', () => {
    let first = startPlaying(0x51a)
    let second = startPlaying(0x51a)
    let previous = first.aiRunners.map(({ progress }) => progress)
    for (let index = 0; index < 8; index += 1) {
      first = advanceRunningRace(first, { deltaMs: 1_000, input: FULL_INPUT })
      second = advanceRunningRace(second, { deltaMs: 1_000, input: FULL_INPUT })
      expect(first.aiRunners).toEqual(second.aiRunners)
      first.aiRunners.forEach(({ progress }, runnerIndex) => {
        expect(progress).toBeGreaterThanOrEqual(previous[runnerIndex] ?? 0)
      })
      previous = first.aiRunners.map(({ progress }) => progress)
    }
    expect(first.aiRunners.find(({ id }) => id === 'FINISHER')?.progress).toBeGreaterThan(0)
  })

  it('makes the finisher pace more aggressive in the final sprint', () => {
    let early = startPlaying(4)
    early = advanceRunningRace(early, { deltaMs: 10_000, input: IDLE_INPUT })
    const earlyFinisher = early.aiRunners.find(({ id }) => id === 'FINISHER')?.progress ?? 0
    let late = advanceRunningRace(early, { deltaMs: 40_000, input: IDLE_INPUT })
    const lateGain = (late.aiRunners.find(({ id }) => id === 'FINISHER')?.progress ?? 0) - earlyFinisher
    expect(lateGain).toBeGreaterThan(earlyFinisher * 2)
  })

  it('emits one deterministic overtake per newly passed AI and does not count losing position', () => {
    let state = startPlaying(9)
    state = advanceRunningRace(state, { deltaMs: 4_000, input: IDLE_INPUT })
    const rankAfterLoss = state.playerRank
    expect(rankAfterLoss).toBeGreaterThan(1)

    const beforeOvertakes = state.overtakes
    state = advanceRunningRace(state, { deltaMs: 10_000, input: FULL_INPUT })
    expect(state.playerRank).toBe(1)
    expect(state.overtakes).toBeGreaterThan(beforeOvertakes)
    const overtakeCount = state.overtakes
    state = advanceRunningRace(state, { deltaMs: 1_000, input: FULL_INPUT })
    expect(state.overtakes).toBe(overtakeCount)
    expect(state.overtakeEvents.length).toBe(overtakeCount)
  })
})

describe('RunningRaceCore result and scoring', () => {
  it('tracks new step presentation once without scoring individual steps', () => {
    const playing = startPlaying()
    const stepped = advanceRunningRace(playing, {
      deltaMs: 100,
      input: { ...FULL_INPUT, newStepSide: 'LEFT', newStepSequence: 4 },
    })
    expect(stepped.latestStep).toEqual({ side: 'LEFT', sequence: 4, atMs: 100 })
    expect(stepped.gameSteps).toBe(1)
    const duplicate = advanceRunningRace(stepped, {
      deltaMs: 100,
      input: { ...FULL_INPUT, newStepSide: 'LEFT', newStepSequence: 4 },
    })
    expect(duplicate.gameSteps).toBe(1)
  })

  it('runs exactly 60 seconds, freezes final ranking and keeps score stable', () => {
    let state = startPlaying()
    state = advanceRunningRace(state, { deltaMs: 59_999, input: FULL_INPUT })
    expect(state.phase).toBe('PLAYING')
    expect(state.roundRemainingMs).toBe(1)
    state = advanceRunningRace(state, { deltaMs: 1, input: FULL_INPUT })
    expect(state.phase).toBe('FINISHED')
    expect(state.elapsedMs).toBe(60_000)
    expect(state.roundRemainingMs).toBe(0)
    expect(state.finalPlace).toBeGreaterThanOrEqual(1)
    expect(state.finalPlace).toBeLessThanOrEqual(4)
    const finished = state
    expect(advanceRunningRace(state, { deltaMs: 5_000, input: FULL_INPUT })).toEqual(finished)
    expect(replayRunningRace(state)).toEqual(createRunningRaceState({ seed: state.initialSeed }))
  })

  it('uses non-negative arcade score from progress, overtakes, and placement bonus', () => {
    let state = startPlaying()
    state = advanceRunningRace(state, { deltaMs: 60_000, input: FULL_INPUT })
    const finalPlace = state.finalPlace
    if (finalPlace === null) throw new Error('Finished race must have a final place.')
    expect(state.score).toBeGreaterThanOrEqual(0)
    expect(state.score).toBe(
        Math.round(state.playerProgress * RUNNING_RACE_RULES.progressScorePerUnit) +
        state.overtakes * RUNNING_RACE_RULES.overtakeScore +
        (RUNNING_RACE_RULES.placementBonus[finalPlace] ?? 0),
    )
  })
})
