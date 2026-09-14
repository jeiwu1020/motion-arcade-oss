export const LONG_JUMP_RULES = Object.freeze({
  attempts: 3,
  countdownMs: 3_000,
  attemptReadyMs: 800,
  chargeMs: 5_000,
  takeoffWindowMs: 2_000,
  flightMs: 1_200,
  resultMs: 1_000,
  transitionMs: 700,
  chargeGainPerSecond: 0.22,
  idealTakeoffTimeMs: 1_400,
  timingQualityWindowMs: 600,
  perfectTimingMs: 120,
  greatTimingMs: 250,
  goodTimingMs: 450,
  visualTravelBase: 0.4,
  visualTravelRange: 0.6,
})

export type LongJumpPhase =
  | 'COUNTDOWN'
  | 'ATTEMPT_READY'
  | 'CHARGE'
  | 'TAKEOFF_WINDOW'
  | 'FLIGHT'
  | 'RESULT'
  | 'ATTEMPT_TRANSITION'
  | 'FINISHED'

export type LongJumpGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'OK'
export type LongJumpResolution = 'JUMP' | 'NO_JUMP'
export type LongJumpStepSide = 'LEFT' | 'RIGHT'

/** The small normalized input boundary consumed by Long Jump Core. */
export interface LongJumpInputSnapshot {
  readonly locomotionAvailable?: boolean
  readonly locomotionIntensity?: number
  readonly newStepSide?: LongJumpStepSide
  readonly newStepSequence?: number
  readonly newJumpSequence?: number
}

export interface LongJumpFrame {
  readonly deltaMs: number
  readonly input?: LongJumpInputSnapshot
}

export interface LongJumpAttemptResult {
  readonly attemptIndex: number
  readonly charge: number
  readonly timingOffsetMs: number | null
  readonly timingQuality: number
  readonly launchQuality: number
  readonly arcadeDistance: number
  readonly visualTravel: number
  readonly grade: LongJumpGrade | null
  readonly resolution: LongJumpResolution
  readonly scoreAwarded: number
}

export type LongJumpPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: LongJumpPhase; attemptIndex: number; sequence: number }>
  | Readonly<{
      kind: 'STEP'
      side: LongJumpStepSide
      sequence: number
      attemptIndex: number
      eventSequence: number
    }>
  | Readonly<{
      kind: 'ATTEMPT_RESULT'
      attemptIndex: number
      resolution: LongJumpResolution
      grade: LongJumpGrade | null
      arcadeDistance: number
      sequence: number
    }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

type LongJumpPresentationEventInput =
  | Readonly<{ kind: 'PHASE_START'; phase: LongJumpPhase; attemptIndex: number }>
  | Readonly<{ kind: 'STEP'; side: LongJumpStepSide; sequence: number; attemptIndex: number }>
  | Readonly<{
      kind: 'ATTEMPT_RESULT'
      attemptIndex: number
      resolution: LongJumpResolution
      grade: LongJumpGrade | null
      arcadeDistance: number
    }>
  | Readonly<{ kind: 'ROUND_FINISH' }>

export interface LongJumpFinalResult {
  readonly totalScore: number
  readonly attempts: number
  readonly bestArcadeDistance: number
  readonly averageArcadeDistance: number
  readonly bestCharge: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly okCount: number
  readonly noJumpCount: number
  readonly detectedGameSteps: number
}

export interface LongJumpState {
  readonly phase: LongJumpPhase
  readonly attemptIndex: number
  readonly countdownRemainingMs: number
  readonly phaseRemainingMs: number
  /** Active game time, excluding the initial countdown. */
  readonly elapsedMs: number
  readonly attemptElapsedMs: number
  readonly chargeElapsedMs: number
  readonly takeoffElapsedMs: number
  readonly takeoffValue: number
  readonly idealTakeoffTimeMs: number
  readonly charge: number
  readonly timingOffsetMs: number | null
  readonly timingQuality: number
  readonly launchQuality: number
  readonly arcadeDistance: number
  readonly visualTravel: number
  readonly grade: LongJumpGrade | null
  readonly lastAttempt: LongJumpAttemptResult | null
  readonly attemptResults: readonly LongJumpAttemptResult[]
  readonly totalScore: number
  readonly attemptsCompleted: number
  readonly bestArcadeDistance: number
  readonly averageArcadeDistance: number
  readonly bestCharge: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly okCount: number
  readonly noJumpCount: number
  readonly detectedGameSteps: number
  readonly latestStepSide: LongJumpStepSide | null
  readonly latestStepSequence: number
  readonly presentationEvents: readonly LongJumpPresentationEvent[]
  readonly finalResult: LongJumpFinalResult | null
  readonly initialSeed: number
  readonly lastConsumedJumpSequence: number
  readonly lastConsumedStepSequence: number
}

export interface CreateLongJumpStateOptions {
  readonly seed?: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function safeDelta(deltaMs: number): number {
  return Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
}

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? 0) >>> 0 : 0
}

export function timingQualityForOffset(offsetMs: number): number {
  const absoluteOffset = Math.abs(Number.isFinite(offsetMs) ? offsetMs : LONG_JUMP_RULES.timingQualityWindowMs)
  return clamp01(1 - absoluteOffset / LONG_JUMP_RULES.timingQualityWindowMs)
}

export function gradeForTimingOffset(offsetMs: number): LongJumpGrade {
  const absoluteOffset = Math.abs(Number.isFinite(offsetMs) ? offsetMs : Number.POSITIVE_INFINITY)
  if (absoluteOffset <= LONG_JUMP_RULES.perfectTimingMs) return 'PERFECT'
  if (absoluteOffset <= LONG_JUMP_RULES.greatTimingMs) return 'GREAT'
  if (absoluteOffset <= LONG_JUMP_RULES.goodTimingMs) return 'GOOD'
  return 'OK'
}

export function launchQualityFor(charge: number, timingQuality: number): number {
  return clamp01(clamp01(charge) * 0.7 + clamp01(timingQuality) * 0.3)
}

function freezeState(state: LongJumpState): LongJumpState {
  return Object.freeze({
    ...state,
    attemptResults: Object.freeze(state.attemptResults.map((result) => Object.freeze({ ...result }))),
    lastAttempt: state.lastAttempt ? Object.freeze({ ...state.lastAttempt }) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze({ ...event }))),
    finalResult: state.finalResult ? Object.freeze({ ...state.finalResult }) : null,
  })
}

function eventSequence(state: LongJumpState): number {
  return state.presentationEvents.length + 1
}

function withEvent(state: LongJumpState, event: LongJumpPresentationEventInput): LongJumpState {
  const sequence = eventSequence(state)
  if (event.kind === 'STEP') {
    return {
      ...state,
      presentationEvents: [...state.presentationEvents, { ...event, eventSequence: sequence } as LongJumpPresentationEvent],
    }
  }
  return {
    ...state,
    presentationEvents: [...state.presentationEvents, { ...event, sequence } as LongJumpPresentationEvent],
  }
}

function resetAttempt(state: LongJumpState): LongJumpState {
  return {
    ...state,
    attemptElapsedMs: 0,
    chargeElapsedMs: 0,
    takeoffElapsedMs: 0,
    takeoffValue: 0,
    charge: 0,
    timingOffsetMs: null,
    timingQuality: 0,
    launchQuality: 0,
    arcadeDistance: 0,
    visualTravel: LONG_JUMP_RULES.visualTravelBase,
    grade: null,
    lastAttempt: null,
  }
}

function enterPhase(state: LongJumpState, phase: LongJumpPhase, phaseRemainingMs: number): LongJumpState {
  return withEvent({ ...state, phase, phaseRemainingMs }, {
    kind: 'PHASE_START',
    phase,
    attemptIndex: state.attemptIndex,
  })
}

function attemptScore(arcadeDistance: number): number {
  return Math.max(0, Math.round(clamp01(arcadeDistance / 100) * 100) * 10)
}

function resolveJump(state: LongJumpState, sequence: number): LongJumpState {
  if (!Number.isInteger(sequence) || sequence <= state.lastConsumedJumpSequence) return state
  const consumed = { ...state, lastConsumedJumpSequence: sequence }
  if (state.phase !== 'TAKEOFF_WINDOW') return consumed

  const timingOffsetMs = state.takeoffElapsedMs - LONG_JUMP_RULES.idealTakeoffTimeMs
  const timingQuality = timingQualityForOffset(timingOffsetMs)
  const launchQuality = launchQualityFor(state.charge, timingQuality)
  const arcadeDistance = Math.round(launchQuality * 100)
  const result: LongJumpAttemptResult = Object.freeze({
    attemptIndex: state.attemptIndex,
    charge: state.charge,
    timingOffsetMs,
    timingQuality,
    launchQuality,
    arcadeDistance,
    visualTravel: LONG_JUMP_RULES.visualTravelBase + launchQuality * LONG_JUMP_RULES.visualTravelRange,
    grade: gradeForTimingOffset(timingOffsetMs),
    resolution: 'JUMP',
    scoreAwarded: attemptScore(arcadeDistance),
  })
  const next: LongJumpState = {
    ...consumed,
    phase: 'FLIGHT',
    phaseRemainingMs: LONG_JUMP_RULES.flightMs,
    attemptElapsedMs: state.attemptElapsedMs,
    timingOffsetMs,
    timingQuality,
    launchQuality,
    arcadeDistance,
    visualTravel: result.visualTravel,
    grade: result.grade,
    lastAttempt: result,
    totalScore: state.totalScore + result.scoreAwarded,
    attemptsCompleted: state.attemptsCompleted + 1,
    bestArcadeDistance: Math.max(state.bestArcadeDistance, arcadeDistance),
    averageArcadeDistance: (state.averageArcadeDistance * state.attemptsCompleted + arcadeDistance) / (state.attemptsCompleted + 1),
    bestCharge: Math.max(state.bestCharge, state.charge),
    perfectCount: state.perfectCount + (result.grade === 'PERFECT' ? 1 : 0),
    greatCount: state.greatCount + (result.grade === 'GREAT' ? 1 : 0),
    goodCount: state.goodCount + (result.grade === 'GOOD' ? 1 : 0),
    okCount: state.okCount + (result.grade === 'OK' ? 1 : 0),
    attemptResults: [...state.attemptResults, result],
  }
  return withEvent(next, {
    kind: 'ATTEMPT_RESULT',
    attemptIndex: result.attemptIndex,
    resolution: result.resolution,
    grade: result.grade,
    arcadeDistance: result.arcadeDistance,
  })
}

function resolveNoJump(state: LongJumpState): LongJumpState {
  const result: LongJumpAttemptResult = Object.freeze({
    attemptIndex: state.attemptIndex,
    charge: state.charge,
    timingOffsetMs: null,
    timingQuality: 0,
    launchQuality: 0,
    arcadeDistance: 0,
    visualTravel: LONG_JUMP_RULES.visualTravelBase,
    grade: null,
    resolution: 'NO_JUMP',
    scoreAwarded: 0,
  })
  const next: LongJumpState = {
    ...state,
    phase: 'RESULT',
    phaseRemainingMs: LONG_JUMP_RULES.resultMs,
    timingOffsetMs: null,
    timingQuality: 0,
    launchQuality: 0,
    arcadeDistance: 0,
    visualTravel: result.visualTravel,
    grade: null,
    lastAttempt: result,
    attemptsCompleted: state.attemptsCompleted + 1,
    averageArcadeDistance: (state.averageArcadeDistance * state.attemptsCompleted) / (state.attemptsCompleted + 1),
    bestCharge: Math.max(state.bestCharge, state.charge),
    noJumpCount: state.noJumpCount + 1,
    attemptResults: [...state.attemptResults, result],
  }
  return withEvent(next, {
    kind: 'ATTEMPT_RESULT',
    attemptIndex: result.attemptIndex,
    resolution: result.resolution,
    grade: null,
    arcadeDistance: 0,
  })
}

function enterNextPhase(state: LongJumpState): LongJumpState {
  switch (state.phase) {
    case 'COUNTDOWN':
      return enterPhase(resetAttempt({ ...state, countdownRemainingMs: 0 }), 'ATTEMPT_READY', LONG_JUMP_RULES.attemptReadyMs)
    case 'ATTEMPT_READY':
      return enterPhase({ ...state, phase: 'CHARGE', charge: 0, chargeElapsedMs: 0 }, 'CHARGE', LONG_JUMP_RULES.chargeMs)
    case 'CHARGE':
      return enterPhase({ ...state, takeoffElapsedMs: 0, timingOffsetMs: null, timingQuality: 0 }, 'TAKEOFF_WINDOW', LONG_JUMP_RULES.takeoffWindowMs)
    case 'TAKEOFF_WINDOW':
      return resolveNoJump(state)
    case 'FLIGHT':
      return enterPhase(state, 'RESULT', LONG_JUMP_RULES.resultMs)
    case 'RESULT':
      return enterPhase(state, 'ATTEMPT_TRANSITION', LONG_JUMP_RULES.transitionMs)
    case 'ATTEMPT_TRANSITION': {
      if (state.attemptIndex >= LONG_JUMP_RULES.attempts - 1) {
        const finalResult: LongJumpFinalResult = Object.freeze({
          totalScore: Math.max(0, state.totalScore),
          attempts: state.attemptsCompleted,
          bestArcadeDistance: state.bestArcadeDistance,
          averageArcadeDistance: state.attemptsCompleted === 0
            ? 0
            : state.attemptResults.reduce((sum, result) => sum + result.arcadeDistance, 0) / state.attemptsCompleted,
          bestCharge: state.bestCharge,
          perfectCount: state.perfectCount,
          greatCount: state.greatCount,
          goodCount: state.goodCount,
          okCount: state.okCount,
          noJumpCount: state.noJumpCount,
          detectedGameSteps: state.detectedGameSteps,
        })
        return withEvent({ ...state, phase: 'FINISHED', phaseRemainingMs: 0, finalResult }, { kind: 'ROUND_FINISH' })
      }
      const next = resetAttempt({ ...state, attemptIndex: state.attemptIndex + 1 })
      return enterPhase(next, 'ATTEMPT_READY', LONG_JUMP_RULES.attemptReadyMs)
    }
    case 'FINISHED':
      return state
  }
}

function applyStep(state: LongJumpState, input: LongJumpInputSnapshot | undefined): LongJumpState {
  const sequence = input?.newStepSequence
  if (!input?.newStepSide || typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence <= state.lastConsumedStepSequence) {
    return state
  }
  const next = {
    ...state,
    latestStepSide: input.newStepSide,
    latestStepSequence: sequence,
    lastConsumedStepSequence: sequence,
    detectedGameSteps: state.detectedGameSteps + 1,
  }
  return withEvent(next, {
    kind: 'STEP',
    side: input.newStepSide,
    sequence,
    attemptIndex: state.attemptIndex,
  })
}

function advanceTimedPhase(state: LongJumpState, deltaMs: number, input: LongJumpInputSnapshot | undefined): LongJumpState {
  if (deltaMs <= 0) return state
  const step = Math.min(deltaMs, state.phaseRemainingMs)
  if (state.phase === 'COUNTDOWN') {
    return {
      ...state,
      countdownRemainingMs: Math.max(0, state.countdownRemainingMs - step),
      phaseRemainingMs: state.phaseRemainingMs - step,
    }
  }
  const elapsedMs = state.elapsedMs + step
  if (state.phase === 'CHARGE') {
    const available = input?.locomotionAvailable ?? false
    const intensity = available ? clamp01(input?.locomotionIntensity ?? 0) : 0
    return {
      ...state,
      elapsedMs,
      phaseRemainingMs: state.phaseRemainingMs - step,
      attemptElapsedMs: state.attemptElapsedMs + step,
      chargeElapsedMs: state.chargeElapsedMs + step,
      charge: clamp01(state.charge + intensity * (step / 1_000) * LONG_JUMP_RULES.chargeGainPerSecond),
    }
  }
  if (state.phase === 'TAKEOFF_WINDOW') {
    const takeoffElapsedMs = state.takeoffElapsedMs + step
    return {
      ...state,
      elapsedMs,
      phaseRemainingMs: state.phaseRemainingMs - step,
      attemptElapsedMs: state.attemptElapsedMs + step,
      takeoffElapsedMs,
    }
  }
  return {
    ...state,
    elapsedMs,
    phaseRemainingMs: state.phaseRemainingMs - step,
    attemptElapsedMs: state.attemptElapsedMs + step,
  }
}

export function createLongJumpState(options: CreateLongJumpStateOptions = {}): LongJumpState {
  const initialSeed = normalizedSeed(options.seed)
  return freezeState({
    phase: 'COUNTDOWN',
    attemptIndex: 0,
    countdownRemainingMs: LONG_JUMP_RULES.countdownMs,
    phaseRemainingMs: LONG_JUMP_RULES.countdownMs,
    elapsedMs: 0,
    attemptElapsedMs: 0,
    chargeElapsedMs: 0,
    takeoffElapsedMs: 0,
    takeoffValue: 0,
    idealTakeoffTimeMs: LONG_JUMP_RULES.idealTakeoffTimeMs,
    charge: 0,
    timingOffsetMs: null,
    timingQuality: 0,
    launchQuality: 0,
    arcadeDistance: 0,
    visualTravel: LONG_JUMP_RULES.visualTravelBase,
    grade: null,
    lastAttempt: null,
    attemptResults: [],
    totalScore: 0,
    attemptsCompleted: 0,
    bestArcadeDistance: 0,
    averageArcadeDistance: 0,
    bestCharge: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    okCount: 0,
    noJumpCount: 0,
    detectedGameSteps: 0,
    latestStepSide: null,
    latestStepSequence: 0,
    presentationEvents: [],
    finalResult: null,
    initialSeed,
    lastConsumedJumpSequence: 0,
    lastConsumedStepSequence: 0,
  })
}

export function advanceLongJump(state: LongJumpState, frame: LongJumpFrame): LongJumpState {
  if (state.phase === 'FINISHED') return state
  let current = applyStep(state, frame.input)
  if (frame.input?.newJumpSequence !== undefined) {
    current = resolveJump(current, frame.input.newJumpSequence)
  }
  let remainingMs = safeDelta(frame.deltaMs)

  while (remainingMs > 0 && current.phase !== 'FINISHED') {
    if (current.phaseRemainingMs <= 0) {
      current = enterNextPhase(current)
      continue
    }
    const step = Math.min(remainingMs, current.phaseRemainingMs)
    current = advanceTimedPhase(current, step, frame.input)
    remainingMs -= step
    if (current.phaseRemainingMs <= 0) current = enterNextPhase(current)
  }

  return freezeState(current)
}

export function replayLongJump(state: LongJumpState): LongJumpState {
  return createLongJumpState({ seed: state.initialSeed })
}
