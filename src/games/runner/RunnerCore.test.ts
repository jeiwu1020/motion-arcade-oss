import { describe, expect, it } from 'vitest'

import {
  RUNNER_RULES,
  advanceRunner,
  createRunnerState,
  replayRunner,
  type RunnerObstacle,
  type RunnerState,
} from './RunnerCore'

function startPlaying(seed = 7): RunnerState {
  return advanceRunner(createRunnerState({ seed }), {
    deltaMs: RUNNER_RULES.countdownMs,
  })
}

function withObstacles(
  state: RunnerState,
  obstacles: readonly RunnerObstacle[],
): RunnerState {
  return {
    ...state,
    obstacles: Object.freeze(obstacles.map((obstacle) => Object.freeze({ ...obstacle }))),
    nextObstacleIndex: 0,
    lastEncounter: null,
  }
}

function laneGate(id: number, encounterMs: number, safeLane: 'LEFT' | 'CENTER' | 'RIGHT'): RunnerObstacle {
  return Object.freeze({ id, type: 'LANE_GATE', encounterMs, safeLane })
}

function actionObstacle(
  id: number,
  encounterMs: number,
  type: 'LOW_HURDLE' | 'OVERHEAD_GATE',
): RunnerObstacle {
  return Object.freeze({ id, type, encounterMs, safeLane: null })
}

describe('RunnerCore countdown and initial state', () => {
  it('starts a three-second countdown in the center lane', () => {
    const state = createRunnerState({ seed: 12 })

    expect(state).toMatchObject({
      phase: 'COUNTDOWN',
      gameplayPhase: 'WARM_UP',
      countdownRemainingMs: 3_000,
      roundRemainingMs: 60_000,
      elapsedMs: 0,
      lane: 'CENTER',
      score: 0,
    })
  })

  it('progresses countdown through repeated small frames', () => {
    let state = createRunnerState({ seed: 12 })
    for (let frame = 0; frame < 60; frame += 1) {
      state = advanceRunner(state, { deltaMs: 50 })
    }

    expect(state.phase).toBe('PLAYING')
    expect(state.countdownRemainingMs).toBe(0)
    expect(state.elapsedMs).toBe(0)
    expect(state.roundRemainingMs).toBe(60_000)
  })
})

describe('RunnerCore actions', () => {
  it('moves one lane for each lateral action and clamps at both boundaries', () => {
    let state = startPlaying()

    state = advanceRunner(state, { deltaMs: 0, actions: ['MOVE_LEFT'] })
    expect(state.lane).toBe('LEFT')
    state = advanceRunner(state, { deltaMs: 0, actions: ['MOVE_LEFT'] })
    expect(state.lane).toBe('LEFT')
    state = advanceRunner(state, { deltaMs: 0, actions: ['MOVE_RIGHT'] })
    expect(state.lane).toBe('CENTER')
    state = advanceRunner(state, { deltaMs: 0, actions: ['MOVE_RIGHT'] })
    expect(state.lane).toBe('RIGHT')
    state = advanceRunner(state, { deltaMs: 0, actions: ['MOVE_RIGHT'] })
    expect(state.lane).toBe('RIGHT')
  })

  it('runs the lane presentation transition for 220ms', () => {
    let state = startPlaying()
    state = advanceRunner(state, { deltaMs: 0, actions: ['MOVE_LEFT'] })

    expect(state.laneTransition).toMatchObject({
      from: 'CENTER',
      to: 'LEFT',
      elapsedMs: 0,
      durationMs: 220,
    })

    state = advanceRunner(state, { deltaMs: 219 })
    expect(state.laneTransition?.elapsedMs).toBe(219)
    state = advanceRunner(state, { deltaMs: 1 })
    expect(state.laneTransition).toBeNull()
  })

  it('starts one 850ms jump, does not stack it, and returns to running', () => {
    let state = startPlaying()
    state = advanceRunner(state, { deltaMs: 0, actions: ['JUMP'] })
    expect(state.jumpElapsedMs).toBe(0)

    state = advanceRunner(state, { deltaMs: 300 })
    state = advanceRunner(state, { deltaMs: 0, actions: ['JUMP'] })
    expect(state.jumpElapsedMs).toBe(300)

    state = advanceRunner(state, { deltaMs: 549 })
    expect(state.jumpElapsedMs).toBe(849)
    state = advanceRunner(state, { deltaMs: 1 })
    expect(state.jumpElapsedMs).toBeNull()
  })

  it('starts one 850ms duck, does not extend it, and returns to running', () => {
    let state = startPlaying()
    state = advanceRunner(state, { deltaMs: 0, actions: ['SQUAT'] })
    expect(state.duckElapsedMs).toBe(0)

    state = advanceRunner(state, { deltaMs: 400 })
    state = advanceRunner(state, { deltaMs: 0, actions: ['SQUAT'] })
    expect(state.duckElapsedMs).toBe(400)

    state = advanceRunner(state, { deltaMs: 449 })
    expect(state.duckElapsedMs).toBe(849)
    state = advanceRunner(state, { deltaMs: 1 })
    expect(state.duckElapsedMs).toBeNull()
  })

  it('ignores duck while jumping and jump while ducking', () => {
    let jumping = startPlaying()
    jumping = advanceRunner(jumping, { deltaMs: 0, actions: ['JUMP', 'SQUAT'] })
    expect(jumping.jumpElapsedMs).toBe(0)
    expect(jumping.duckElapsedMs).toBeNull()

    let ducking = startPlaying()
    ducking = advanceRunner(ducking, { deltaMs: 0, actions: ['SQUAT', 'JUMP'] })
    expect(ducking.duckElapsedMs).toBe(0)
    expect(ducking.jumpElapsedMs).toBeNull()
  })
})

describe('RunnerCore deterministic course and fairness', () => {
  it('generates the same obstacle sequence, timing, and safe lanes for the same seed', () => {
    const first = createRunnerState({ seed: 0x51a })
    const second = createRunnerState({ seed: 0x51a })

    expect(first.obstacles).toEqual(second.obstacles)
    expect(replayRunner(first).obstacles).toEqual(first.obstacles)
  })

  it('teaches all three obstacle families during warm-up', () => {
    const state = createRunnerState({ seed: 9 })
    const warmUpTypes = state.obstacles
      .filter(({ encounterMs }) => encounterMs < RUNNER_RULES.warmUpEndMs)
      .map(({ type }) => type)

    expect(warmUpTypes).toEqual(['LANE_GATE', 'LOW_HURDLE', 'OVERHEAD_GATE'])
  })

  it('keeps opposing jump and duck encounters outside the recovery safety window', () => {
    const obstacles = createRunnerState({ seed: 99 }).obstacles
    for (let index = 1; index < obstacles.length; index += 1) {
      const previous = obstacles[index - 1]!
      const current = obstacles[index]!
      const opposingActions =
        (previous.type === 'LOW_HURDLE' && current.type === 'OVERHEAD_GATE') ||
        (previous.type === 'OVERHEAD_GATE' && current.type === 'LOW_HURDLE')
      if (opposingActions) {
        expect(current.encounterMs - previous.encounterMs)
          .toBeGreaterThanOrEqual(RUNNER_RULES.minimumActionRecoverySpacingMs)
      }
    }
  })

  it('never schedules more than two identical obstacle requirements consecutively', () => {
    const obstacles = createRunnerState({ seed: 123 }).obstacles
    for (let index = 2; index < obstacles.length; index += 1) {
      expect([
        obstacles[index - 2]!.type,
        obstacles[index - 1]!.type,
        obstacles[index]!.type,
      ]).not.toEqual([
        obstacles[index]!.type,
        obstacles[index]!.type,
        obstacles[index]!.type,
      ])
    }
  })
})

describe('RunnerCore obstacle resolution', () => {
  it('clears a lane gate only when the logical lane matches its safe lane', () => {
    const base = startPlaying()
    const success = advanceRunner(
      withObstacles(base, [laneGate(1, 500, 'CENTER')]),
      { deltaMs: 500 },
    )
    const failure = advanceRunner(
      withObstacles(base, [laneGate(1, 500, 'LEFT')]),
      { deltaMs: 500 },
    )

    expect(success.lastEncounter).toMatchObject({ obstacleId: 1, outcome: 'CLEARED' })
    expect(failure.lastEncounter).toMatchObject({ obstacleId: 1, outcome: 'COLLISION' })
  })

  it('clears a low hurdle only during the effective jump window', () => {
    const base = withObstacles(startPlaying(), [actionObstacle(1, 500, 'LOW_HURDLE')])
    const success = advanceRunner(base, { deltaMs: 500, actions: ['JUMP'] })
    const failure = advanceRunner(base, { deltaMs: 500 })

    expect(success.lastEncounter?.outcome).toBe('CLEARED')
    expect(failure.lastEncounter?.outcome).toBe('COLLISION')
  })

  it('clears an overhead gate only during the effective duck window', () => {
    const base = withObstacles(startPlaying(), [actionObstacle(1, 500, 'OVERHEAD_GATE')])
    const success = advanceRunner(base, { deltaMs: 500, actions: ['SQUAT'] })
    const failure = advanceRunner(base, { deltaMs: 500 })

    expect(success.lastEncounter?.outcome).toBe('CLEARED')
    expect(failure.lastEncounter?.outcome).toBe('COLLISION')
  })
})

describe('RunnerCore scoring and round lifecycle', () => {
  it('awards 100 plus a bounded streak bonus for successful obstacles', () => {
    const obstacles = Array.from({ length: 7 }, (_, index) =>
      laneGate(index + 1, (index + 1) * 100, 'CENTER'))
    const state = advanceRunner(withObstacles(startPlaying(), obstacles), { deltaMs: 700 })

    expect(state).toMatchObject({
      score: 900,
      obstaclesCleared: 7,
      collisions: 0,
      currentStreak: 7,
      bestStreak: 7,
    })
    expect(state.lastEncounter?.scoreAward).toBe(150)
  })

  it('never subtracts score on collision, resets current streak, and preserves best streak', () => {
    const state = advanceRunner(
      withObstacles(startPlaying(), [
        laneGate(1, 100, 'CENTER'),
        laneGate(2, 200, 'CENTER'),
        laneGate(3, 300, 'LEFT'),
      ]),
      { deltaMs: 300 },
    )

    expect(state).toMatchObject({
      score: 210,
      obstaclesCleared: 2,
      collisions: 1,
      currentStreak: 0,
      bestStreak: 2,
    })
    expect(state.lastEncounter?.scoreAward).toBe(0)
  })

  it('transitions through pacing phases and starts final rush at 50 seconds', () => {
    let state = withObstacles(startPlaying(), [])
    state = advanceRunner(state, { deltaMs: 15_000 })
    expect(state.gameplayPhase).toBe('FLOW')
    state = advanceRunner(state, { deltaMs: 25_000 })
    expect(state.gameplayPhase).toBe('CHALLENGE')
    state = advanceRunner(state, { deltaMs: 10_000 })
    expect(state.gameplayPhase).toBe('FINAL_RUSH')
    expect(state.presentationEvents).toContainEqual({ kind: 'FINAL_RUSH_START', sequence: 1 })
  })

  it('finishes exactly at 60 seconds and keeps result statistics stable', () => {
    let state = withObstacles(startPlaying(), [])
    state = advanceRunner(state, { deltaMs: 59_999 })
    expect(state.phase).toBe('PLAYING')
    expect(state.roundRemainingMs).toBe(1)

    state = advanceRunner(state, { deltaMs: 1 })
    expect(state.phase).toBe('FINISHED')
    expect(state.elapsedMs).toBe(60_000)
    expect(state.roundRemainingMs).toBe(0)
    const finished = state

    expect(advanceRunner(state, { deltaMs: 5_000, actions: ['MOVE_LEFT', 'JUMP'] }))
      .toEqual(finished)
  })
})
