import type {
  MotionActionState,
  PlayerMotionState,
} from '../../motion/contracts/motion'

export const BALLOON_POP_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  targetLifetimeMs: 2_500,
  nextTargetDelayMs: 350,
})

export type BalloonPopPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type BalloonSide = 'LEFT' | 'RIGHT'

export interface BalloonTarget {
  readonly id: number
  readonly side: BalloonSide
  readonly remainingMs: number
}

export interface BalloonPopState {
  readonly phase: BalloonPopPhase
  readonly countdownRemainingMs: number
  readonly roundRemainingMs: number
  readonly score: number
  readonly hits: number
  readonly misses: number
  readonly target: BalloonTarget | null
  readonly nextTargetInMs: number
  readonly nextTargetId: number
  readonly randomState: number
  readonly initialSeed: number
  readonly lastReachSequence: Readonly<{
    left: number | null
    right: number | null
  }>
}

export interface BalloonPopFrame {
  readonly deltaMs: number
  readonly actions: PlayerMotionState['actions']
}

export interface CreateBalloonPopStateOptions {
  readonly seed?: number
}

const DEFAULT_SEED = 0x2a1b00b5

function freezeTarget(target: BalloonTarget | null): BalloonTarget | null {
  return target ? Object.freeze({ ...target }) : null
}

function freezeState(state: BalloonPopState): BalloonPopState {
  return Object.freeze({
    ...state,
    target: freezeTarget(state.target),
    lastReachSequence: Object.freeze({ ...state.lastReachSequence }),
  })
}

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

export function createBalloonPopState(
  options: CreateBalloonPopStateOptions = {},
): BalloonPopState {
  const seed = normalizedSeed(options.seed)
  return freezeState({
    phase: 'COUNTDOWN',
    countdownRemainingMs: BALLOON_POP_RULES.countdownMs,
    roundRemainingMs: BALLOON_POP_RULES.roundMs,
    score: 0,
    hits: 0,
    misses: 0,
    target: null,
    nextTargetInMs: 0,
    nextTargetId: 1,
    randomState: seed,
    initialSeed: seed,
    lastReachSequence: { left: null, right: null },
  })
}

function startedSequence(action: MotionActionState | undefined): number | null {
  return action?.phase === 'started' && action.value !== 0
    ? action.sequence
    : null
}

function observeNewReaches(
  state: BalloonPopState,
  actions: PlayerMotionState['actions'],
): {
  readonly state: BalloonPopState
  readonly newReachSides: readonly BalloonSide[]
} {
  const leftSequence = startedSequence(actions.REACH_LEFT)
  const rightSequence = startedSequence(actions.REACH_RIGHT)
  const newReachSides: BalloonSide[] = []
  let nextLeft = state.lastReachSequence.left
  let nextRight = state.lastReachSequence.right

  if (leftSequence !== null && leftSequence !== nextLeft) {
    nextLeft = leftSequence
    newReachSides.push('LEFT')
  }
  if (rightSequence !== null && rightSequence !== nextRight) {
    nextRight = rightSequence
    newReachSides.push('RIGHT')
  }

  if (nextLeft === state.lastReachSequence.left && nextRight === state.lastReachSequence.right) {
    return { state, newReachSides }
  }
  return {
    state: freezeState({
      ...state,
      lastReachSequence: { left: nextLeft, right: nextRight },
    }),
    newReachSides,
  }
}

function spawnTarget(state: BalloonPopState): BalloonPopState {
  const side: BalloonSide = state.randomState % 2 === 0 ? 'LEFT' : 'RIGHT'
  const nextRandomState =
    (Math.imul(state.randomState, 1_664_525) + 1_013_904_223) >>> 0
  return freezeState({
    ...state,
    target: {
      id: state.nextTargetId,
      side,
      remainingMs: BALLOON_POP_RULES.targetLifetimeMs,
    },
    nextTargetInMs: 0,
    nextTargetId: state.nextTargetId + 1,
    randomState: nextRandomState,
  })
}

function hitTarget(state: BalloonPopState): BalloonPopState {
  return freezeState({
    ...state,
    score: state.score + 1,
    hits: state.hits + 1,
    target: null,
    nextTargetInMs: BALLOON_POP_RULES.nextTargetDelayMs,
  })
}

function expireTarget(state: BalloonPopState): BalloonPopState {
  return freezeState({
    ...state,
    misses: state.misses + 1,
    target: null,
    nextTargetInMs: BALLOON_POP_RULES.nextTargetDelayMs,
  })
}

function finishRound(state: BalloonPopState): BalloonPopState {
  return freezeState({
    ...state,
    phase: 'FINISHED',
    roundRemainingMs: 0,
    target: null,
    nextTargetInMs: 0,
  })
}

function advancePlaying(
  inputState: BalloonPopState,
  deltaMs: number,
  newReachSides: readonly BalloonSide[],
): BalloonPopState {
  let state = inputState
  if (state.target && newReachSides.includes(state.target.side)) {
    state = hitTarget(state)
  }

  let remainingDeltaMs = deltaMs
  while (remainingDeltaMs > 0 && state.phase === 'PLAYING') {
    const targetEventMs = state.target
      ? state.target.remainingMs
      : state.nextTargetInMs
    const stepMs = Math.min(
      remainingDeltaMs,
      state.roundRemainingMs,
      targetEventMs,
    )
    const target = state.target
      ? { ...state.target, remainingMs: state.target.remainingMs - stepMs }
      : null
    state = freezeState({
      ...state,
      roundRemainingMs: state.roundRemainingMs - stepMs,
      target,
      nextTargetInMs: target
        ? 0
        : Math.max(0, state.nextTargetInMs - stepMs),
    })
    remainingDeltaMs -= stepMs

    if (state.roundRemainingMs <= 0) return finishRound(state)
    if (state.target?.remainingMs === 0) {
      state = expireTarget(state)
      continue
    }
    if (!state.target && state.nextTargetInMs === 0) {
      state = spawnTarget(state)
      continue
    }
    if (stepMs === 0) break
  }
  return state
}

export function advanceBalloonPop(
  inputState: BalloonPopState,
  frame: BalloonPopFrame,
): BalloonPopState {
  const deltaMs = Math.max(
    0,
    Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0,
  )
  const observed = observeNewReaches(inputState, frame.actions)
  let state = observed.state

  if (state.phase === 'FINISHED') return state
  if (state.phase === 'PLAYING') {
    return advancePlaying(state, deltaMs, observed.newReachSides)
  }

  if (deltaMs < state.countdownRemainingMs) {
    return freezeState({
      ...state,
      countdownRemainingMs: state.countdownRemainingMs - deltaMs,
    })
  }

  const playingDeltaMs = deltaMs - state.countdownRemainingMs
  state = spawnTarget(
    freezeState({
      ...state,
      phase: 'PLAYING',
      countdownRemainingMs: 0,
    }),
  )
  return advancePlaying(state, playingDeltaMs, [])
}

export function replayBalloonPop(state: BalloonPopState): BalloonPopState {
  return createBalloonPopState({ seed: state.initialSeed })
}
