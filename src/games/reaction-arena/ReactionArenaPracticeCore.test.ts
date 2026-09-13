import { describe, expect, it } from 'vitest'

import {
  advanceReactionArenaPractice,
  createReactionArenaPracticeState,
  PRACTICE_SUCCESS_FEEDBACK_MS,
  REACTION_ARENA_PRACTICE_ACTIONS,
} from './ReactionArenaPracticeCore'

describe('ReactionArenaPracticeCore', () => {
  it('starts with the exact five-action practice order', () => {
    const state = createReactionArenaPracticeState()

    expect(REACTION_ARENA_PRACTICE_ACTIONS).toEqual([
      'LEFT',
      'RIGHT',
      'REACH_LEFT',
      'REACH_RIGHT',
      'SQUAT',
    ])
    expect(state.currentAction).toBe('LEFT')
    expect(state.currentIndex).toBe(0)
    expect(state.phase).toBe('PRACTICING')
  })

  it('does not advance for a wrong action or an action already held before the cue', () => {
    const initial = createReactionArenaPracticeState()
    const wrong = advanceReactionArenaPractice(initial, {
      deltaMs: 16,
      actionAttempts: [{ action: 'RIGHT', sequence: 1 }],
    })

    expect(wrong.currentAction).toBe('LEFT')
    expect(wrong.currentIndex).toBe(0)
    expect(wrong.lastRecognizedAction).toBe('RIGHT')

    const preHeld = advanceReactionArenaPractice(initial, {
      deltaMs: 16,
      actionAttempts: [],
    })
    expect(preHeld.currentAction).toBe('LEFT')
  })

  it('accepts one matching new occurrence and holds obvious success feedback before advancing', () => {
    const success = advanceReactionArenaPractice(createReactionArenaPracticeState(), {
      deltaMs: 16,
      actionAttempts: [{ action: 'LEFT', sequence: 1 }],
    })

    expect(success.phase).toBe('SUCCESS_FEEDBACK')
    expect(success.successCount).toBe(1)
    expect(success.feedbackRemainingMs).toBe(PRACTICE_SUCCESS_FEEDBACK_MS)
    expect(success.presentationEvents).toEqual([
      { kind: 'PRACTICE_SUCCESS', sequence: 1, action: 'LEFT' },
    ])

    const stillShowing = advanceReactionArenaPractice(success, {
      deltaMs: PRACTICE_SUCCESS_FEEDBACK_MS - 1,
      actionAttempts: [{ action: 'LEFT', sequence: 1 }],
    })
    expect(stillShowing.phase).toBe('SUCCESS_FEEDBACK')
    expect(stillShowing.currentAction).toBe('LEFT')

    const next = advanceReactionArenaPractice(stillShowing, {
      deltaMs: 1,
      actionAttempts: [],
    })
    expect(next.phase).toBe('PRACTICING')
    expect(next.currentAction).toBe('RIGHT')
    expect(next.currentIndex).toBe(1)
  })

  it('requires distinct occurrences for every action and completes only after all five successes', () => {
    let state = createReactionArenaPracticeState()
    for (const [index, action] of REACTION_ARENA_PRACTICE_ACTIONS.entries()) {
      state = advanceReactionArenaPractice(state, {
        deltaMs: 0,
        actionAttempts: [{ action, sequence: index + 1 }],
      })
      expect(state.successCount).toBe(index + 1)
      state = advanceReactionArenaPractice(state, {
        deltaMs: PRACTICE_SUCCESS_FEEDBACK_MS,
        actionAttempts: [{ action, sequence: index + 1 }],
      })
    }

    expect(state.phase).toBe('COMPLETE')
    expect(state.currentAction).toBeNull()
    expect(state.successCount).toBe(5)
    expect(state.lastRecognizedAction).toBe('SQUAT')
  })

  it('never expires without an action and replay returns to LEFT without score, timer, or combo', () => {
    const state = advanceReactionArenaPractice(createReactionArenaPracticeState(), {
      deltaMs: 60_000,
      actionAttempts: [],
    })

    expect(state.phase).toBe('PRACTICING')
    expect(state.currentAction).toBe('LEFT')
    expect(state.successCount).toBe(0)
    expect(state).not.toHaveProperty('score')
    expect(state).not.toHaveProperty('combo')
  })
})
