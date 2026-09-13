import type { MotionActionId } from '../../motion/contracts/motion'

import {
  normalizeReactionArenaAction,
  type ReactionArenaCueKind,
} from './ReactionArenaCore'

export const REACTION_ARENA_PRACTICE_ACTIONS = Object.freeze([
  'LEFT',
  'RIGHT',
  'REACH_LEFT',
  'REACH_RIGHT',
  'SQUAT',
] as const satisfies readonly ReactionArenaCueKind[])

export const PRACTICE_SUCCESS_FEEDBACK_MS = 1_000

export type ReactionArenaPracticePhase =
  | 'PRACTICING'
  | 'SUCCESS_FEEDBACK'
  | 'COMPLETE'

export interface ReactionArenaPracticeActionAttempt {
  readonly action: MotionActionId | ReactionArenaCueKind
  readonly sequence: number
}

export type ReactionArenaPracticePresentationEvent = Readonly<{
  kind: 'PRACTICE_SUCCESS'
  sequence: number
  action: ReactionArenaCueKind
}>

export interface ReactionArenaPracticeState {
  readonly phase: ReactionArenaPracticePhase
  readonly currentIndex: number
  readonly currentAction: ReactionArenaCueKind | null
  readonly lastRecognizedAction: ReactionArenaCueKind | null
  readonly lastRecognizedSequence: number | null
  readonly feedbackRemainingMs: number
  readonly successCount: number
  readonly successSequence: number
  readonly presentationEvents: readonly ReactionArenaPracticePresentationEvent[]
}

export interface ReactionArenaPracticeFrame {
  readonly deltaMs: number
  readonly actionAttempts?: readonly ReactionArenaPracticeActionAttempt[]
}

function freezeState(state: ReactionArenaPracticeState): ReactionArenaPracticeState {
  return Object.freeze({
    ...state,
    presentationEvents: Object.freeze(
      state.presentationEvents.map((event) => Object.freeze({ ...event })),
    ),
  })
}

export function createReactionArenaPracticeState(): ReactionArenaPracticeState {
  return freezeState({
    phase: 'PRACTICING',
    currentIndex: 0,
    currentAction: REACTION_ARENA_PRACTICE_ACTIONS[0],
    lastRecognizedAction: null,
    lastRecognizedSequence: null,
    feedbackRemainingMs: 0,
    successCount: 0,
    successSequence: 0,
    presentationEvents: [],
  })
}

export function replayReactionArenaPractice(): ReactionArenaPracticeState {
  return createReactionArenaPracticeState()
}

function completeSuccess(
  state: ReactionArenaPracticeState,
  action: ReactionArenaCueKind,
  sequence: number,
): ReactionArenaPracticeState {
  return freezeState({
    ...state,
    phase: 'SUCCESS_FEEDBACK',
    lastRecognizedAction: action,
    lastRecognizedSequence: sequence,
    feedbackRemainingMs: PRACTICE_SUCCESS_FEEDBACK_MS,
    successCount: state.successCount + 1,
    successSequence: state.successSequence + 1,
    presentationEvents: [
      ...state.presentationEvents,
      { kind: 'PRACTICE_SUCCESS', sequence, action },
    ],
  })
}

function advanceAfterFeedback(state: ReactionArenaPracticeState): ReactionArenaPracticeState {
  const nextIndex = state.currentIndex + 1
  const nextAction = REACTION_ARENA_PRACTICE_ACTIONS[nextIndex]
  if (!nextAction) {
    return freezeState({
      ...state,
      phase: 'COMPLETE',
      currentIndex: REACTION_ARENA_PRACTICE_ACTIONS.length,
      currentAction: null,
      feedbackRemainingMs: 0,
    })
  }
  return freezeState({
    ...state,
    phase: 'PRACTICING',
    currentIndex: nextIndex,
    currentAction: nextAction,
    feedbackRemainingMs: 0,
  })
}

export function advanceReactionArenaPractice(
  state: ReactionArenaPracticeState,
  frame: ReactionArenaPracticeFrame,
): ReactionArenaPracticeState {
  if (state.phase === 'COMPLETE') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)

  if (state.phase === 'SUCCESS_FEEDBACK') {
    const remaining = Math.max(0, state.feedbackRemainingMs - deltaMs)
    return remaining === 0
      ? advanceAfterFeedback(state)
      : freezeState({ ...state, feedbackRemainingMs: remaining })
  }

  let next = state
  for (const attempt of frame.actionAttempts ?? []) {
    const action = normalizeReactionArenaAction(attempt.action)
    if (!action || next.phase !== 'PRACTICING') continue
    next = freezeState({
      ...next,
      lastRecognizedAction: action,
      lastRecognizedSequence: attempt.sequence,
    })
    if (action === next.currentAction) {
      next = completeSuccess(next, action, attempt.sequence)
    }
  }
  return next
}
