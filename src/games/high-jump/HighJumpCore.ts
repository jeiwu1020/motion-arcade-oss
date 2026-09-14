export const HIGH_JUMP_RULES = Object.freeze({
  countdownMs: 3_000,
  readyMs: 700,
  approachMs: 6_000,
  takeoffMs: 300,
  flightMs: 900,
  resultMs: 1_000,
  transitionMs: 700,
  meterCycleMs: 2_400,
  meterHalfCycleMs: 1_200,
  stageThresholds: Object.freeze([0.5, 0.58, 0.66, 0.74, 0.82]),
  gradeThresholds: Object.freeze({ PERFECT: 0.9, GREAT: 0.78, GOOD: 0.64 }),
  gradePoints: Object.freeze({ PERFECT: 300, GREAT: 220, GOOD: 150, OK: 80 }),
  clearBonus: 200,
  stageClearBonuses: Object.freeze([0, 50, 100, 150, 250]),
})

export type HighJumpPhase =
  | 'COUNTDOWN'
  | 'READY_FOR_ATTEMPT'
  | 'APPROACH'
  | 'TAKEOFF'
  | 'FLIGHT'
  | 'RESULT'
  | 'STAGE_TRANSITION'
  | 'FINISHED'
export type HighJumpGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'OK'
export type HighJumpResolution = 'CLEAR' | 'MISS' | 'NO_JUMP'
export type HighJumpMeterDirection = 'RISING' | 'FALLING'

/** The only input the Core needs: a fresh normalized JUMP occurrence. */
export interface HighJumpJumpInput {
  readonly sequence: number
}

export interface HighJumpFrame {
  readonly deltaMs: number
  readonly input?: HighJumpJumpInput
}

export interface HighJumpAttemptResult {
  readonly stageIndex: number
  readonly takeoffValue: number
  readonly stageThreshold: number
  readonly grade: HighJumpGrade | null
  readonly resolution: HighJumpResolution
  readonly cleared: boolean
  readonly scoreAwarded: number
}

export type HighJumpPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: HighJumpPhase; stageIndex: number; sequence: number }>
  | Readonly<{
      kind: 'ATTEMPT_RESULT'
      stageIndex: number
      resolution: HighJumpResolution
      grade: HighJumpGrade | null
      cleared: boolean
      takeoffValue: number
      sequence: number
    }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

type HighJumpPresentationEventInput =
  | Readonly<{ kind: 'PHASE_START'; phase: HighJumpPhase; stageIndex: number }>
  | Readonly<{
      kind: 'ATTEMPT_RESULT'
      stageIndex: number
      resolution: HighJumpResolution
      grade: HighJumpGrade | null
      cleared: boolean
      takeoffValue: number
    }>
  | Readonly<{ kind: 'ROUND_FINISH' }>

export interface HighJumpFinalResult {
  readonly score: number
  readonly barsCleared: number
  readonly bestClearedLevel: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly okCount: number
  readonly noJumpCount: number
}

export interface HighJumpState {
  readonly phase: HighJumpPhase
  readonly stageIndex: number
  readonly currentStage: number
  readonly countdownRemainingMs: number
  readonly phaseRemainingMs: number
  readonly elapsedMs: number
  readonly attemptElapsedMs: number
  readonly takeoffMeterElapsedMs: number
  readonly takeoffValue: number
  readonly meterDirection: HighJumpMeterDirection
  readonly stageThreshold: number
  readonly lastAttempt: HighJumpAttemptResult | null
  readonly score: number
  readonly barsCleared: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly okCount: number
  readonly noJumpCount: number
  readonly bestClearedLevel: number
  readonly presentationEvents: readonly HighJumpPresentationEvent[]
  readonly finalResult: HighJumpFinalResult | null
  readonly initialSeed: number
  readonly lastConsumedJumpSequence: number
}

export interface CreateHighJumpStateOptions {
  readonly seed?: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function safeDelta(deltaMs: number): number {
  return Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
}

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? 0) >>> 0 : 0
}

export function takeoffMeterValueAt(elapsedMs: number): number {
  const cycleMs = ((Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) % HIGH_JUMP_RULES.meterCycleMs) + HIGH_JUMP_RULES.meterCycleMs) % HIGH_JUMP_RULES.meterCycleMs
  return cycleMs <= HIGH_JUMP_RULES.meterHalfCycleMs
    ? cycleMs / HIGH_JUMP_RULES.meterHalfCycleMs
    : 2 - cycleMs / HIGH_JUMP_RULES.meterHalfCycleMs
}

export function takeoffMeterDirectionAt(elapsedMs: number): HighJumpMeterDirection {
  const cycleMs = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) % HIGH_JUMP_RULES.meterCycleMs
  return cycleMs < HIGH_JUMP_RULES.meterHalfCycleMs ? 'RISING' : 'FALLING'
}

export function gradeForTakeoff(takeoffValue: number): HighJumpGrade {
  const value = clamp(takeoffValue, 0, 1)
  if (value >= HIGH_JUMP_RULES.gradeThresholds.PERFECT) return 'PERFECT'
  if (value >= HIGH_JUMP_RULES.gradeThresholds.GREAT) return 'GREAT'
  if (value >= HIGH_JUMP_RULES.gradeThresholds.GOOD) return 'GOOD'
  return 'OK'
}

export function stageThresholdAt(stageIndex: number): number {
  const index = clamp(Math.trunc(stageIndex), 0, HIGH_JUMP_RULES.stageThresholds.length - 1)
  return HIGH_JUMP_RULES.stageThresholds[index] ?? 0
}

function freezeState(state: HighJumpState): HighJumpState {
  return Object.freeze({
    ...state,
    lastAttempt: state.lastAttempt ? Object.freeze({ ...state.lastAttempt }) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze({ ...event }))),
    finalResult: state.finalResult ? Object.freeze({ ...state.finalResult }) : null,
  })
}

function eventSequence(state: HighJumpState): number {
  return state.presentationEvents.length + 1
}

function withEvent(
  state: HighJumpState,
  event: HighJumpPresentationEventInput,
): HighJumpState {
  return {
    ...state,
    presentationEvents: [
      ...state.presentationEvents,
      { ...event, sequence: eventSequence(state) } as HighJumpPresentationEvent,
    ],
  }
}

function resetAttemptFields(state: HighJumpState): HighJumpState {
  return {
    ...state,
    phaseRemainingMs: HIGH_JUMP_RULES.approachMs,
    attemptElapsedMs: 0,
    takeoffMeterElapsedMs: 0,
    takeoffValue: 0,
    meterDirection: 'RISING',
    stageThreshold: stageThresholdAt(state.stageIndex),
  }
}

function readyForStage(state: HighJumpState, phase: 'READY_FOR_ATTEMPT' | 'APPROACH'): HighJumpState {
  const reset = resetAttemptFields(state)
  return {
    ...reset,
    phase,
    phaseRemainingMs: phase === 'READY_FOR_ATTEMPT' ? HIGH_JUMP_RULES.readyMs : HIGH_JUMP_RULES.approachMs,
  }
}

function attemptScore(stageIndex: number, grade: HighJumpGrade, cleared: boolean): number {
  const gradeScore = HIGH_JUMP_RULES.gradePoints[grade]
  const stageBonus = HIGH_JUMP_RULES.stageClearBonuses[stageIndex] ?? 0
  return gradeScore + (cleared ? HIGH_JUMP_RULES.clearBonus + stageBonus : 0)
}

function resolveJump(state: HighJumpState, sequence: number): HighJumpState {
  if (!Number.isInteger(sequence) || sequence <= state.lastConsumedJumpSequence) return state
  const consumed = { ...state, lastConsumedJumpSequence: sequence }
  if (state.phase !== 'APPROACH') return consumed

  const takeoffValue = clamp(state.takeoffValue, 0, 1)
  const grade = gradeForTakeoff(takeoffValue)
  const cleared = takeoffValue >= state.stageThreshold
  const result: HighJumpAttemptResult = Object.freeze({
    stageIndex: state.stageIndex,
    takeoffValue,
    stageThreshold: state.stageThreshold,
    grade,
    resolution: cleared ? 'CLEAR' : 'MISS',
    cleared,
    scoreAwarded: attemptScore(state.stageIndex, grade, cleared),
  })
  let next: HighJumpState = {
    ...consumed,
    phase: 'TAKEOFF',
    phaseRemainingMs: HIGH_JUMP_RULES.takeoffMs,
    lastAttempt: result,
    score: state.score + result.scoreAwarded,
    barsCleared: state.barsCleared + (cleared ? 1 : 0),
    perfectCount: state.perfectCount + (grade === 'PERFECT' ? 1 : 0),
    greatCount: state.greatCount + (grade === 'GREAT' ? 1 : 0),
    goodCount: state.goodCount + (grade === 'GOOD' ? 1 : 0),
    okCount: state.okCount + (grade === 'OK' ? 1 : 0),
    bestClearedLevel: cleared ? Math.max(state.bestClearedLevel, state.currentStage) : state.bestClearedLevel,
  }
  next = withEvent(next, {
    kind: 'ATTEMPT_RESULT',
    stageIndex: result.stageIndex,
    resolution: result.resolution,
    grade: result.grade,
    cleared: result.cleared,
    takeoffValue: result.takeoffValue,
  })
  return next
}

function resolveNoJump(state: HighJumpState): HighJumpState {
  const result: HighJumpAttemptResult = Object.freeze({
    stageIndex: state.stageIndex,
    takeoffValue: state.takeoffValue,
    stageThreshold: state.stageThreshold,
    grade: null,
    resolution: 'NO_JUMP',
    cleared: false,
    scoreAwarded: 0,
  })
  let next: HighJumpState = {
    ...state,
    phase: 'RESULT',
    phaseRemainingMs: HIGH_JUMP_RULES.resultMs,
    lastAttempt: result,
    noJumpCount: state.noJumpCount + 1,
  }
  next = withEvent(next, {
    kind: 'ATTEMPT_RESULT',
    stageIndex: result.stageIndex,
    resolution: result.resolution,
    grade: null,
    cleared: false,
    takeoffValue: result.takeoffValue,
  })
  return next
}

function enterNextPhase(state: HighJumpState): HighJumpState {
  switch (state.phase) {
    case 'COUNTDOWN': {
      const next = readyForStage({ ...state, countdownRemainingMs: 0 }, 'READY_FOR_ATTEMPT')
      return withEvent(next, { kind: 'PHASE_START', phase: next.phase, stageIndex: next.stageIndex })
    }
    case 'READY_FOR_ATTEMPT': {
      const next = readyForStage(state, 'APPROACH')
      return withEvent(next, { kind: 'PHASE_START', phase: next.phase, stageIndex: next.stageIndex })
    }
    case 'APPROACH':
      return resolveNoJump(state)
    case 'TAKEOFF':
      return { ...state, phase: 'FLIGHT', phaseRemainingMs: HIGH_JUMP_RULES.flightMs }
    case 'FLIGHT':
      return { ...state, phase: 'RESULT', phaseRemainingMs: HIGH_JUMP_RULES.resultMs }
    case 'RESULT':
      return { ...state, phase: 'STAGE_TRANSITION', phaseRemainingMs: HIGH_JUMP_RULES.transitionMs }
    case 'STAGE_TRANSITION': {
      if (state.stageIndex >= HIGH_JUMP_RULES.stageThresholds.length - 1) {
        const finalResult: HighJumpFinalResult = Object.freeze({
          score: Math.max(0, state.score),
          barsCleared: state.barsCleared,
          bestClearedLevel: state.bestClearedLevel,
          perfectCount: state.perfectCount,
          greatCount: state.greatCount,
          goodCount: state.goodCount,
          okCount: state.okCount,
          noJumpCount: state.noJumpCount,
        })
        const finished = {
          ...state,
          phase: 'FINISHED' as const,
          phaseRemainingMs: 0,
          finalResult,
        }
        return withEvent(finished, { kind: 'ROUND_FINISH' })
      }
      const nextStage = {
        ...state,
        stageIndex: state.stageIndex + 1,
        currentStage: state.currentStage + 1,
      }
      return withEvent(readyForStage(nextStage, 'READY_FOR_ATTEMPT'), {
        kind: 'PHASE_START',
        phase: 'READY_FOR_ATTEMPT',
        stageIndex: nextStage.stageIndex,
      })
    }
    case 'FINISHED':
      return state
  }
}

function advanceTimedPhase(state: HighJumpState, deltaMs: number): HighJumpState {
  if (deltaMs <= 0) return state
  const step = Math.min(deltaMs, state.phaseRemainingMs)
  const nextElapsedMs = state.elapsedMs + step
  if (state.phase === 'APPROACH') {
    const meterElapsedMs = state.takeoffMeterElapsedMs + step
    return {
      ...state,
      elapsedMs: nextElapsedMs,
      phaseRemainingMs: state.phaseRemainingMs - step,
      attemptElapsedMs: state.attemptElapsedMs + step,
      takeoffMeterElapsedMs: meterElapsedMs,
      takeoffValue: takeoffMeterValueAt(meterElapsedMs),
      meterDirection: takeoffMeterDirectionAt(meterElapsedMs),
    }
  }
  if (state.phase === 'COUNTDOWN') {
    return {
      ...state,
      countdownRemainingMs: state.countdownRemainingMs - step,
      phaseRemainingMs: state.phaseRemainingMs - step,
    }
  }
  return { ...state, elapsedMs: nextElapsedMs, phaseRemainingMs: state.phaseRemainingMs - step }
}

export function createHighJumpState(options: CreateHighJumpStateOptions = {}): HighJumpState {
  const initialSeed = normalizedSeed(options.seed)
  return freezeState({
    phase: 'COUNTDOWN',
    stageIndex: 0,
    currentStage: 1,
    countdownRemainingMs: HIGH_JUMP_RULES.countdownMs,
    phaseRemainingMs: HIGH_JUMP_RULES.countdownMs,
    elapsedMs: 0,
    attemptElapsedMs: 0,
    takeoffMeterElapsedMs: 0,
    takeoffValue: 0,
    meterDirection: 'RISING',
    stageThreshold: stageThresholdAt(0),
    lastAttempt: null,
    score: 0,
    barsCleared: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    okCount: 0,
    noJumpCount: 0,
    bestClearedLevel: 0,
    presentationEvents: [],
    finalResult: null,
    initialSeed,
    lastConsumedJumpSequence: 0,
  })
}

export function advanceHighJump(state: HighJumpState, frame: HighJumpFrame): HighJumpState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = safeDelta(frame.deltaMs)
  let current = frame.input ? resolveJump(state, frame.input.sequence) : state
  let remainingMs = deltaMs

  while (remainingMs > 0 && current.phase !== 'FINISHED') {
    if (current.phaseRemainingMs <= 0) {
      current = enterNextPhase(current)
      continue
    }
    const step = Math.min(remainingMs, current.phaseRemainingMs)
    current = advanceTimedPhase(current, step)
    remainingMs -= step
    if (current.phaseRemainingMs <= 0) current = enterNextPhase(current)
  }

  return freezeState(current)
}

export function replayHighJump(state: HighJumpState): HighJumpState {
  return createHighJumpState({ seed: state.initialSeed })
}
