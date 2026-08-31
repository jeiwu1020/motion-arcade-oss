import { describe, expect, it } from 'vitest'

import type {
  MotionActionId,
  MotionActionState,
  PlayerMotionState,
} from '../../motion/contracts/motion'
import {
  advanceBalloonPop,
  BALLOON_POP_RULES,
  createBalloonPopState,
  replayBalloonPop,
  type BalloonPopState,
} from './BalloonPopCore'

function started(
  id: Extract<MotionActionId, 'REACH_LEFT' | 'REACH_RIGHT'>,
  sequence: number,
): MotionActionState {
  return {
    id,
    value: 1,
    phase: 'started',
    confidence: 1,
    timestampMs: 0,
    sequence,
  }
}

function actions(
  left?: MotionActionState,
  right?: MotionActionState,
): PlayerMotionState['actions'] {
  return {
    ...(left ? { REACH_LEFT: left } : {}),
    ...(right ? { REACH_RIGHT: right } : {}),
  }
}

function begin(seed = 2): BalloonPopState {
  return advanceBalloonPop(createBalloonPopState({ seed }), {
    deltaMs: BALLOON_POP_RULES.countdownMs,
    actions: {},
  })
}

describe('Balloon Pop core', () => {
  it('starts with a neutral three-second countdown', () => {
    const state = createBalloonPopState({ seed: 2 })

    expect(state).toMatchObject({
      phase: 'COUNTDOWN',
      countdownRemainingMs: 3_000,
      roundRemainingMs: 60_000,
      score: 0,
      hits: 0,
      misses: 0,
      target: null,
    })
  })

  it('transitions from countdown to playing and spawns one target', () => {
    const initial = createBalloonPopState({ seed: 2 })

    const almostReady = advanceBalloonPop(initial, {
      deltaMs: 2_999,
      actions: {},
    })
    const playing = advanceBalloonPop(almostReady, {
      deltaMs: 1,
      actions: {},
    })

    expect(almostReady.phase).toBe('COUNTDOWN')
    expect(playing).toMatchObject({
      phase: 'PLAYING',
      countdownRemainingMs: 0,
      roundRemainingMs: 60_000,
      target: { id: 1, side: 'LEFT' },
    })
  })

  it.each([
    ['LEFT', 2, 'REACH_LEFT'],
    ['RIGHT', 1, 'REACH_RIGHT'],
  ] as const)('scores a matching %s reach exactly once', (_side, seed, id) => {
    const playing = begin(seed)

    const hit = advanceBalloonPop(playing, {
      deltaMs: 0,
      actions: actions(
        id === 'REACH_LEFT' ? started(id, 10) : undefined,
        id === 'REACH_RIGHT' ? started(id, 10) : undefined,
      ),
    })

    expect(hit).toMatchObject({
      phase: 'PLAYING',
      score: 1,
      hits: 1,
      misses: 0,
      target: null,
      nextTargetInMs: BALLOON_POP_RULES.nextTargetDelayMs,
    })
  })

  it('does not score a wrong-side reach', () => {
    const playing = begin(2)

    const wrongSide = advanceBalloonPop(playing, {
      deltaMs: 0,
      actions: actions(undefined, started('REACH_RIGHT', 10)),
    })

    expect(wrongSide.score).toBe(0)
    expect(wrongSide.hits).toBe(0)
    expect(wrongSide.target).toEqual(playing.target)
  })

  it('requires a new started sequence before the same reach can score again', () => {
    let state = begin(2)
    const heldLeft = started('REACH_LEFT', 10)

    state = advanceBalloonPop(state, {
      deltaMs: 0,
      actions: actions(heldLeft),
    })
    state = advanceBalloonPop(state, {
      deltaMs: BALLOON_POP_RULES.nextTargetDelayMs,
      actions: actions(heldLeft),
    })
    state = advanceBalloonPop(state, {
      deltaMs: 0,
      actions: actions(heldLeft, started('REACH_RIGHT', 11)),
    })
    state = advanceBalloonPop(state, {
      deltaMs: BALLOON_POP_RULES.nextTargetDelayMs,
      actions: actions(heldLeft),
    })

    const heldDoesNotScore = advanceBalloonPop(state, {
      deltaMs: 0,
      actions: actions(heldLeft),
    })
    const newReachScores = advanceBalloonPop(heldDoesNotScore, {
      deltaMs: 0,
      actions: actions(started('REACH_LEFT', 12)),
    })

    expect(state.target?.side).toBe('LEFT')
    expect(heldDoesNotScore.score).toBe(2)
    expect(newReachScores.score).toBe(3)
  })

  it('expires a balloon as a miss before scheduling the next target', () => {
    const playing = begin(2)

    const expired = advanceBalloonPop(playing, {
      deltaMs: BALLOON_POP_RULES.targetLifetimeMs,
      actions: {},
    })

    expect(expired).toMatchObject({
      score: 0,
      hits: 0,
      misses: 1,
      target: null,
      nextTargetInMs: BALLOON_POP_RULES.nextTargetDelayMs,
    })
  })

  it('finishes exactly after sixty seconds of play', () => {
    const finished = advanceBalloonPop(begin(2), {
      deltaMs: BALLOON_POP_RULES.roundMs,
      actions: {},
    })

    expect(finished.phase).toBe('FINISHED')
    expect(finished.roundRemainingMs).toBe(0)
    expect(finished.target).toBeNull()
  })

  it('replay returns to the original countdown and deterministic seed', () => {
    let state = begin(2)
    state = advanceBalloonPop(state, {
      deltaMs: 0,
      actions: actions(started('REACH_LEFT', 10)),
    })
    state = advanceBalloonPop(state, {
      deltaMs: BALLOON_POP_RULES.roundMs,
      actions: {},
    })

    const replayed = replayBalloonPop(state)
    const restarted = advanceBalloonPop(replayed, {
      deltaMs: BALLOON_POP_RULES.countdownMs,
      actions: {},
    })

    expect(replayed).toMatchObject({
      phase: 'COUNTDOWN',
      score: 0,
      hits: 0,
      misses: 0,
      target: null,
    })
    expect(restarted.target).toMatchObject({ id: 1, side: 'LEFT' })
  })

  it('returns new immutable state without mutating its input', () => {
    const initial = createBalloonPopState({ seed: 2 })

    const next = advanceBalloonPop(initial, {
      deltaMs: 1_000,
      actions: {},
    })

    expect(next).not.toBe(initial)
    expect(initial.countdownRemainingMs).toBe(3_000)
    expect(Object.isFrozen(next)).toBe(true)
  })
})
