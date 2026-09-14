export const BOWLING_RULES = Object.freeze({
  countdownMs: 3_000,
  frames: 5,
  ballRollingMs: 1_400,
  pinsSettlingMs: 800,
  frameTransitionMs: 700,
  aimSweepCycleMs: 2_500,
  aimVectorBiasMax: 0.18,
  powerBase: 0.65,
  powerRange: 0.35,
  pinValue: 10,
  strikeBonus: 50,
  spareBonus: 25,
  strikeStreakBonus: 20,
  strikeStreakBonusCap: 60,
})

export const ALL_BOWLING_PIN_IDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

/** Normalized lane positions for the standard 1 / 2 / 3 / 4 visual layout. */
export const BOWLING_PIN_POSITIONS = Object.freeze([
  Object.freeze({ id: 1, x: 0 }),
  Object.freeze({ id: 2, x: -0.16 }),
  Object.freeze({ id: 3, x: 0.16 }),
  Object.freeze({ id: 4, x: -0.32 }),
  Object.freeze({ id: 5, x: 0 }),
  Object.freeze({ id: 6, x: 0.32 }),
  Object.freeze({ id: 7, x: -0.48 }),
  Object.freeze({ id: 8, x: -0.16 }),
  Object.freeze({ id: 9, x: 0.16 }),
  Object.freeze({ id: 10, x: 0.48 }),
])

export type BowlingHand = 'LEFT' | 'RIGHT'
export type BowlingPhase =
  | 'COUNTDOWN'
  | 'AIMING'
  | 'BALL_ROLLING'
  | 'PINS_SETTLING'
  | 'FRAME_TRANSITION'
  | 'FINISHED'
export type BowlingPinResolution = 'PENDING' | 'KNOCKED'
export type BowlingReturnDirection = 'LEFT_CURVE' | 'STRAIGHT' | 'RIGHT_CURVE'

export interface BowlingSwingAttempt {
  readonly hand: BowlingHand
  /** Game-local elapsed time. C0 timestamps do not cross into Core. */
  readonly timestampMs: number
  readonly vectorX: number
  readonly vectorY: number
  readonly intensity: number
  readonly sequence: number
}

export interface BowlingRollResult {
  readonly frameIndex: number
  readonly rollInFrame: 1 | 2
  readonly hand: BowlingHand
  readonly aimAtRelease: number
  readonly effectiveAim: number
  readonly intensity: number
  readonly power: number
  readonly curveBias: number
  readonly knockedPinIds: readonly number[]
  readonly pinsKnocked: number
  readonly strike: boolean
  readonly spare: boolean
  readonly scoreAwarded: number
  readonly returnDirection: BowlingReturnDirection
}

export interface BowlingResult {
  readonly score: number
  readonly totalPinsKnocked: number
  readonly strikes: number
  readonly spares: number
  readonly bestStrikeStreak: number
  readonly leftHandRolls: number
  readonly rightHandRolls: number
}

export type BowlingPresentationEvent =
  | Readonly<{ kind: 'ROLL_RELEASE'; sequence: number; result: BowlingRollResult }>
  | Readonly<{ kind: 'PIN_COUNT'; sequence: number; pinsKnocked: number }>
  | Readonly<{ kind: 'STRIKE'; sequence: number }>
  | Readonly<{ kind: 'SPARE'; sequence: number }>
  | Readonly<{ kind: 'FRAME_START'; sequence: number; frameIndex: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface BowlingState {
  readonly phase: BowlingPhase
  readonly countdownRemainingMs: number
  /** Zero-based frame index; presentation displays frameIndex + 1. */
  readonly frameIndex: number
  readonly rollInFrame: 1 | 2
  readonly elapsedMs: number
  readonly phaseElapsedMs: number
  readonly aimElapsedMs: number
  readonly aimValue: number
  readonly ballProgressMs: number
  readonly ballAimAtRelease: number | null
  readonly ballPower: number | null
  readonly ballCurveBias: number | null
  readonly standingPinIds: readonly number[]
  readonly lastKnockedPinIds: readonly number[]
  readonly score: number
  readonly totalPinsKnocked: number
  readonly strikes: number
  readonly spares: number
  readonly currentStrikeStreak: number
  readonly bestStrikeStreak: number
  readonly leftHandRolls: number
  readonly rightHandRolls: number
  readonly lastRoll: BowlingRollResult | null
  readonly presentationEvents: readonly BowlingPresentationEvent[]
  readonly result: BowlingResult | null
  readonly randomState: number
  readonly initialSeed: number
}

export interface CreateBowlingStateOptions {
  readonly seed?: number
}

export interface BowlingFrame {
  readonly deltaMs: number
  readonly swingAttempts?: readonly BowlingSwingAttempt[]
}

export interface ResolveBowlingPinsInput {
  readonly seed?: number
  readonly effectiveAim: number
  readonly power: number
  readonly standingPinIds: readonly number[]
}

const DEFAULT_SEED = 0x424f574c
function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

/** A deterministic -1 -> +1 -> -1 sweep over exactly 2500ms. */
export function bowlingAimAt(aimElapsedMs: number): number {
  const safeTime = Math.max(0, Number.isFinite(aimElapsedMs) ? aimElapsedMs : 0)
  const phase = (safeTime % BOWLING_RULES.aimSweepCycleMs) / BOWLING_RULES.aimSweepCycleMs
  return phase <= 0.5 ? -1 + phase * 4 : 3 - phase * 4
}

function returnDirectionForAim(effectiveAim: number): BowlingReturnDirection {
  if (effectiveAim < -0.08) return 'LEFT_CURVE'
  if (effectiveAim > 0.08) return 'RIGHT_CURVE'
  return 'STRAIGHT'
}

/**
 * Small deterministic arcade resolver. It uses the projected lane center and
 * a power-scaled hit radius, never a nondeterministic physics simulation.
 * `seed` is accepted as part of the bounded resolver contract; the v1 model
 * intentionally has no marginal random tosses so power remains monotonic.
 */
export function resolveBowlingPins({
  seed: _seed,
  effectiveAim,
  power,
  standingPinIds,
}: ResolveBowlingPinsInput): readonly number[] {
  const safeAim = clamp(effectiveAim, -1, 1)
  const safePower = clamp01(power)
  const impactCenter = safeAim * 0.58
  const impactRadius = 0.1 + safePower * 0.4
  const standing = new Set(standingPinIds)
  const directHits = new Set(
    BOWLING_PIN_POSITIONS
      .filter((pin) => standing.has(pin.id) && Math.abs(pin.x - impactCenter) <= impactRadius)
      .map((pin) => pin.id),
  )
  // One bounded neighbor pass gives marginal hits a readable arcade cascade
  // without turning the resolver into a physics simulation.
  const cascadeRadius = 0.07 + safePower * 0.11
  return BOWLING_PIN_POSITIONS
    .filter((pin) => standing.has(pin.id) && (
      directHits.has(pin.id) ||
      [...directHits].some((directId) => Math.abs(pin.x - (BOWLING_PIN_POSITIONS.find((candidate) => candidate.id === directId)?.x ?? pin.x)) <= cascadeRadius)
    ))
    .map((pin) => pin.id)
}

function freezeRoll(result: BowlingRollResult): BowlingRollResult {
  return Object.freeze({ ...result, knockedPinIds: Object.freeze([...result.knockedPinIds]) })
}

function freezeResult(result: BowlingResult | null): BowlingResult | null {
  return result ? Object.freeze({ ...result }) : null
}

function freezeState(state: BowlingState): BowlingState {
  return Object.freeze({
    ...state,
    standingPinIds: Object.freeze([...state.standingPinIds]),
    lastKnockedPinIds: Object.freeze([...state.lastKnockedPinIds]),
    lastRoll: state.lastRoll ? freezeRoll(state.lastRoll) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze(
      'result' in event ? { ...event, result: freezeRoll(event.result) } : { ...event },
    ))),
    result: freezeResult(state.result),
  })
}

export function createBowlingState(options: CreateBowlingStateOptions = {}): BowlingState {
  const initialSeed = normalizedSeed(options.seed)
  return freezeState({
    phase: 'COUNTDOWN',
    countdownRemainingMs: BOWLING_RULES.countdownMs,
    frameIndex: 0,
    rollInFrame: 1,
    elapsedMs: 0,
    phaseElapsedMs: 0,
    aimElapsedMs: 0,
    aimValue: bowlingAimAt(0),
    ballProgressMs: 0,
    ballAimAtRelease: null,
    ballPower: null,
    ballCurveBias: null,
    standingPinIds: ALL_BOWLING_PIN_IDS,
    lastKnockedPinIds: [],
    score: 0,
    totalPinsKnocked: 0,
    strikes: 0,
    spares: 0,
    currentStrikeStreak: 0,
    bestStrikeStreak: 0,
    leftHandRolls: 0,
    rightHandRolls: 0,
    lastRoll: null,
    presentationEvents: [],
    result: null,
    randomState: initialSeed,
    initialSeed,
  })
}

function addEvent(
  state: BowlingState,
  event: BowlingPresentationEvent,
): BowlingState {
  return freezeState({ ...state, presentationEvents: [...state.presentationEvents, event] })
}

function releaseBall(state: BowlingState, attempt: BowlingSwingAttempt): BowlingState {
  const intensity = clamp01(attempt.intensity)
  const power = BOWLING_RULES.powerBase + intensity * BOWLING_RULES.powerRange
  const curveBias = clamp(attempt.vectorX, -1, 1) * BOWLING_RULES.aimVectorBiasMax
  const aimAtRelease = clamp(state.aimValue, -1, 1)
  const effectiveAim = clamp(aimAtRelease + curveBias, -1, 1)
  const knockedPinIds = resolveBowlingPins({
    seed: state.randomState,
    effectiveAim,
    power,
    standingPinIds: state.standingPinIds,
  })
  const strike = state.rollInFrame === 1 && state.standingPinIds.length === 10 && knockedPinIds.length === 10
  const spare = state.rollInFrame === 2 && knockedPinIds.length === state.standingPinIds.length
  const nextStrikeStreak = strike ? state.currentStrikeStreak + 1 : 0
  const strikeStreakBonus = strike
    ? Math.min(BOWLING_RULES.strikeStreakBonusCap, Math.max(0, nextStrikeStreak - 1) * BOWLING_RULES.strikeStreakBonus)
    : 0
  const scoreAwarded = knockedPinIds.length * BOWLING_RULES.pinValue +
    (strike ? BOWLING_RULES.strikeBonus : 0) +
    (spare ? BOWLING_RULES.spareBonus : 0) +
    strikeStreakBonus
  const result = freezeRoll({
    frameIndex: state.frameIndex,
    rollInFrame: state.rollInFrame,
    hand: attempt.hand,
    aimAtRelease,
    effectiveAim,
    intensity,
    power,
    curveBias,
    knockedPinIds,
    pinsKnocked: knockedPinIds.length,
    strike,
    spare,
    scoreAwarded,
    returnDirection: returnDirectionForAim(effectiveAim),
  })
  const nextState = freezeState({
    ...state,
    phase: 'BALL_ROLLING',
    phaseElapsedMs: 0,
    ballProgressMs: 0,
    ballAimAtRelease: effectiveAim,
    ballPower: power,
    ballCurveBias: curveBias,
    standingPinIds: state.standingPinIds.filter((id) => !knockedPinIds.includes(id)),
    lastKnockedPinIds: knockedPinIds,
    score: Math.max(0, state.score + scoreAwarded),
    totalPinsKnocked: state.totalPinsKnocked + knockedPinIds.length,
    strikes: state.strikes + (strike ? 1 : 0),
    spares: state.spares + (spare ? 1 : 0),
    currentStrikeStreak: nextStrikeStreak,
    bestStrikeStreak: Math.max(state.bestStrikeStreak, nextStrikeStreak),
    leftHandRolls: state.leftHandRolls + (attempt.hand === 'LEFT' ? 1 : 0),
    rightHandRolls: state.rightHandRolls + (attempt.hand === 'RIGHT' ? 1 : 0),
    lastRoll: result,
  })
  let current = addEvent(nextState, { kind: 'ROLL_RELEASE', sequence: nextState.presentationEvents.length + 1, result })
  current = addEvent(current, {
    kind: 'PIN_COUNT',
    sequence: current.presentationEvents.length + 1,
    pinsKnocked: knockedPinIds.length,
  })
  if (strike) current = addEvent(current, { kind: 'STRIKE', sequence: current.presentationEvents.length + 1 })
  if (spare) current = addEvent(current, { kind: 'SPARE', sequence: current.presentationEvents.length + 1 })
  return current
}

function advanceAiming(state: BowlingState, deltaMs: number): BowlingState {
  if (deltaMs <= 0) return state
  const aimElapsedMs = state.aimElapsedMs + deltaMs
  return freezeState({
    ...state,
    elapsedMs: state.elapsedMs + deltaMs,
    aimElapsedMs,
    aimValue: bowlingAimAt(aimElapsedMs),
  })
}

function finishBowling(state: BowlingState): BowlingState {
  const result = freezeResult({
    score: state.score,
    totalPinsKnocked: state.totalPinsKnocked,
    strikes: state.strikes,
    spares: state.spares,
    bestStrikeStreak: state.bestStrikeStreak,
    leftHandRolls: state.leftHandRolls,
    rightHandRolls: state.rightHandRolls,
  })
  return addEvent(freezeState({
    ...state,
    phase: 'FINISHED',
    phaseElapsedMs: 0,
    result,
  }), { kind: 'ROUND_FINISH', sequence: state.presentationEvents.length + 1 })
}

function advanceTransition(state: BowlingState): BowlingState {
  if (state.frameIndex >= BOWLING_RULES.frames - 1) return finishBowling(state)
  const frameIndex = state.frameIndex + 1
  const next = freezeState({
    ...state,
    phase: 'AIMING',
    phaseElapsedMs: 0,
    frameIndex,
    rollInFrame: 1,
    standingPinIds: ALL_BOWLING_PIN_IDS,
    lastKnockedPinIds: [],
    ballProgressMs: 0,
    ballAimAtRelease: null,
    ballPower: null,
    ballCurveBias: null,
    currentStrikeStreak: state.lastRoll?.strike ? state.currentStrikeStreak : 0,
  })
  return addEvent(next, { kind: 'FRAME_START', sequence: next.presentationEvents.length + 1, frameIndex })
}

function advanceTimedPhase(state: BowlingState, deltaMs: number): BowlingState {
  if (deltaMs <= 0) return state
  if (state.phase === 'BALL_ROLLING') {
    const phaseElapsedMs = state.phaseElapsedMs + deltaMs
    if (phaseElapsedMs < BOWLING_RULES.ballRollingMs) {
      return freezeState({
        ...state,
        elapsedMs: state.elapsedMs + deltaMs,
        phaseElapsedMs,
        ballProgressMs: phaseElapsedMs,
      })
    }
    const overflow = phaseElapsedMs - BOWLING_RULES.ballRollingMs
    return advanceTimedPhase(freezeState({
      ...state,
      phase: 'PINS_SETTLING',
      elapsedMs: state.elapsedMs + BOWLING_RULES.ballRollingMs,
      phaseElapsedMs: 0,
      ballProgressMs: BOWLING_RULES.ballRollingMs,
    }), overflow)
  }
  if (state.phase === 'PINS_SETTLING') {
    const phaseElapsedMs = state.phaseElapsedMs + deltaMs
    if (phaseElapsedMs < BOWLING_RULES.pinsSettlingMs) {
      return freezeState({ ...state, elapsedMs: state.elapsedMs + deltaMs, phaseElapsedMs })
    }
    const overflow = phaseElapsedMs - BOWLING_RULES.pinsSettlingMs
    const nextPhase = state.lastRoll?.strike || state.rollInFrame === 2 ? 'FRAME_TRANSITION' : 'AIMING'
    return nextPhase === 'AIMING'
      ? advanceAiming(freezeState({ ...state, phase: nextPhase, elapsedMs: state.elapsedMs + BOWLING_RULES.pinsSettlingMs, phaseElapsedMs: 0, rollInFrame: 2 }), overflow)
      : advanceTimedPhase(freezeState({ ...state, phase: nextPhase, elapsedMs: state.elapsedMs + BOWLING_RULES.pinsSettlingMs, phaseElapsedMs: 0 }), overflow)
  }
  if (state.phase === 'FRAME_TRANSITION') {
    const phaseElapsedMs = state.phaseElapsedMs + deltaMs
    if (phaseElapsedMs < BOWLING_RULES.frameTransitionMs) {
      return freezeState({ ...state, elapsedMs: state.elapsedMs + deltaMs, phaseElapsedMs })
    }
    const overflow = phaseElapsedMs - BOWLING_RULES.frameTransitionMs
    const transitioned = advanceTransition(freezeState({ ...state, elapsedMs: state.elapsedMs + BOWLING_RULES.frameTransitionMs, phaseElapsedMs: 0 }))
    return overflow > 0 && transitioned.phase === 'AIMING'
      ? advanceAiming(transitioned, overflow)
      : transitioned
  }
  return advanceAiming(state, deltaMs)
}

export function advanceBowling(state: BowlingState, frame: BowlingFrame): BowlingState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  const attempts = frame.swingAttempts ?? []
  if (state.phase === 'COUNTDOWN') {
    const countdownStep = Math.min(deltaMs, state.countdownRemainingMs)
    const countdownRemainingMs = state.countdownRemainingMs - countdownStep
    const next = freezeState({
      ...state,
      countdownRemainingMs,
      phase: countdownRemainingMs === 0 ? 'AIMING' : 'COUNTDOWN',
    })
    const remainder = deltaMs - countdownStep
    return remainder > 0
      ? advanceBowling(next, { deltaMs: remainder, swingAttempts: attempts })
      : next
  }
  let current = state
  if (state.phase === 'AIMING' && attempts.length > 0) current = releaseBall(state, attempts[0]!)
  if (deltaMs <= 0) return current
  let remaining = deltaMs
  while (remaining > 0 && current.phase !== 'FINISHED') {
    if (current.phase === 'AIMING') {
      current = advanceAiming(current, remaining)
      remaining = 0
    } else if (current.phase === 'BALL_ROLLING') {
      const available = BOWLING_RULES.ballRollingMs - current.phaseElapsedMs
      const step = Math.min(remaining, available)
      current = advanceTimedPhase(current, step)
      remaining -= step
    } else if (current.phase === 'PINS_SETTLING') {
      const available = BOWLING_RULES.pinsSettlingMs - current.phaseElapsedMs
      const step = Math.min(remaining, available)
      current = advanceTimedPhase(current, step)
      remaining -= step
    } else if (current.phase === 'FRAME_TRANSITION') {
      const available = BOWLING_RULES.frameTransitionMs - current.phaseElapsedMs
      const step = Math.min(remaining, available)
      current = advanceTimedPhase(current, step)
      remaining -= step
    } else {
      remaining = 0
    }
  }
  return current
}

export function replayBowling(state: BowlingState): BowlingState {
  return createBowlingState({ seed: state.initialSeed })
}
