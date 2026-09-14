export const SWIMMING_CYCLE_RULES = Object.freeze({
  minimumStrokeIntervalMs: 260,
  maximumStrokeIntervalMs: 1_800,
  recentStrokeWindow: 6,
  recentIntensityWindow: 4,
  maximumStrokeCadence: 200,
  fullRhythmCadence: 150,
  cadenceWeight: 0.65,
  intensityWeight: 0.35,
  propulsionHoldMs: 500,
  propulsionZeroAfterMs: 1_500,
})

export type SwimmingStrokeSide = 'LEFT' | 'RIGHT'

export interface SwimmingStrokeAttempt {
  readonly side: SwimmingStrokeSide
  readonly timestampMs: number
  readonly intensity: number
  readonly sequence: number
  readonly vectorX: number
  readonly vectorY: number
}

export interface SwimmingAcceptedStroke {
  readonly side: SwimmingStrokeSide
  readonly timestampMs: number
  readonly intensity: number
  readonly sequence: number
  readonly vectorX: number
  readonly vectorY: number
}

export interface SwimmingStrokeCycleState {
  readonly expectedNextSide: SwimmingStrokeSide | null
  readonly acceptedTimestamps: readonly number[]
  readonly recentIntensities: readonly number[]
  readonly strokeCadence: number
  readonly recentAverageIntensity: number
  readonly basePropulsion: number
  readonly latestAcceptedStroke: SwimmingAcceptedStroke | null
  readonly acceptedStrokeCount: number
  readonly currentAlternatingStreak: number
  readonly bestAlternatingStreak: number
}

export type SwimmingStrokeOutcome = 'ACCEPTED' | 'WRONG_SIDE' | 'TOO_SOON'

export interface SwimmingStrokeCycleResult {
  readonly state: SwimmingStrokeCycleState
  readonly outcome: SwimmingStrokeOutcome
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function freezeState(state: SwimmingStrokeCycleState): SwimmingStrokeCycleState {
  return Object.freeze({
    ...state,
    acceptedTimestamps: Object.freeze([...state.acceptedTimestamps]),
    recentIntensities: Object.freeze([...state.recentIntensities]),
    latestAcceptedStroke: state.latestAcceptedStroke
      ? Object.freeze({ ...state.latestAcceptedStroke })
      : null,
  })
}

export function createSwimmingStrokeCycle(): SwimmingStrokeCycleState {
  return freezeState({
    expectedNextSide: null,
    acceptedTimestamps: [],
    recentIntensities: [],
    strokeCadence: 0,
    recentAverageIntensity: 0,
    basePropulsion: 0,
    latestAcceptedStroke: null,
    acceptedStrokeCount: 0,
    currentAlternatingStreak: 0,
    bestAlternatingStreak: 0,
  })
}

function cadenceFor(timestamps: readonly number[]): number {
  if (timestamps.length < 2) return 0
  let totalIntervalMs = 0
  for (let index = 1; index < timestamps.length; index += 1) {
    totalIntervalMs += (timestamps[index] ?? 0) - (timestamps[index - 1] ?? 0)
  }
  const meanIntervalMs = totalIntervalMs / (timestamps.length - 1)
  if (meanIntervalMs <= 0) return 0
  return clamp(60_000 / meanIntervalMs, 0, SWIMMING_CYCLE_RULES.maximumStrokeCadence)
}

export function acceptSwimmingStroke(
  state: SwimmingStrokeCycleState,
  attempt: SwimmingStrokeAttempt,
): SwimmingStrokeCycleResult {
  if (state.expectedNextSide !== null && attempt.side !== state.expectedNextSide) {
    return Object.freeze({ state, outcome: 'WRONG_SIDE' as const })
  }

  const timestampMs = Math.max(0, Number.isFinite(attempt.timestampMs) ? attempt.timestampMs : 0)
  const previousTimestampMs = state.latestAcceptedStroke?.timestampMs
  const intervalMs = previousTimestampMs === undefined ? null : timestampMs - previousTimestampMs
  if (intervalMs !== null && intervalMs < SWIMMING_CYCLE_RULES.minimumStrokeIntervalMs) {
    return Object.freeze({ state, outcome: 'TOO_SOON' as const })
  }

  const restarted = intervalMs !== null && intervalMs > SWIMMING_CYCLE_RULES.maximumStrokeIntervalMs
  const acceptedTimestamps = restarted
    ? [timestampMs]
    : [...state.acceptedTimestamps, timestampMs].slice(-SWIMMING_CYCLE_RULES.recentStrokeWindow)
  const intensity = clamp01(attempt.intensity)
  const recentIntensities = (restarted
    ? [intensity]
    : [...state.recentIntensities, intensity]
  ).slice(-SWIMMING_CYCLE_RULES.recentIntensityWindow)
  const strokeCadence = cadenceFor(acceptedTimestamps)
  const recentAverageIntensity = recentIntensities.reduce((sum, value) => sum + value, 0) /
    recentIntensities.length
  const cadenceFactor = clamp01(strokeCadence / SWIMMING_CYCLE_RULES.fullRhythmCadence)
  const basePropulsion = clamp01(
    cadenceFactor * SWIMMING_CYCLE_RULES.cadenceWeight +
      recentAverageIntensity * SWIMMING_CYCLE_RULES.intensityWeight,
  )
  const currentAlternatingStreak = restarted ? 1 : state.currentAlternatingStreak + 1
  const latestAcceptedStroke = Object.freeze({
    side: attempt.side,
    timestampMs,
    intensity,
    sequence: Math.max(0, Math.trunc(Number.isFinite(attempt.sequence) ? attempt.sequence : 0)),
    vectorX: clamp(attempt.vectorX, -1, 1),
    vectorY: clamp(attempt.vectorY, -1, 1),
  })
  const nextState = freezeState({
    expectedNextSide: attempt.side === 'LEFT' ? 'RIGHT' : 'LEFT',
    acceptedTimestamps,
    recentIntensities,
    strokeCadence,
    recentAverageIntensity,
    basePropulsion,
    latestAcceptedStroke,
    acceptedStrokeCount: state.acceptedStrokeCount + 1,
    currentAlternatingStreak,
    bestAlternatingStreak: Math.max(state.bestAlternatingStreak, currentAlternatingStreak),
  })
  return Object.freeze({ state: nextState, outcome: 'ACCEPTED' as const })
}

export function swimmingPropulsionAt(state: SwimmingStrokeCycleState, timestampMs: number): number {
  if (!state.latestAcceptedStroke) return 0
  const ageMs = Math.max(0, timestampMs - state.latestAcceptedStroke.timestampMs)
  if (ageMs <= SWIMMING_CYCLE_RULES.propulsionHoldMs) return state.basePropulsion
  if (ageMs >= SWIMMING_CYCLE_RULES.propulsionZeroAfterMs) return 0
  const decayDurationMs = SWIMMING_CYCLE_RULES.propulsionZeroAfterMs - SWIMMING_CYCLE_RULES.propulsionHoldMs
  return state.basePropulsion * (SWIMMING_CYCLE_RULES.propulsionZeroAfterMs - ageMs) / decayDurationMs
}
