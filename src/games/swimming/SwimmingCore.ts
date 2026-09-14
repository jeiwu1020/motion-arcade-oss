export const SWIMMING_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  cruiseStartMs: 15_000,
  chaseStartMs: 35_000,
  finalSplashStartMs: 50_000,
  propulsionIdleEpsilon: 0.001,
  progressScorePerUnit: 100,
  overtakeScore: 100,
  placementBonus: Object.freeze({ 1: 500, 2: 300, 3: 150, 4: 0 }) as Readonly<Record<number, number>>,
  playerPhaseScale: Object.freeze({ WARM_UP: 0.95, CRUISE: 1, CHASE: 1.04, FINAL_SPLASH: 1.09 }),
  aiPhaseScale: Object.freeze({ WARM_UP: 0.94, CRUISE: 1, CHASE: 1.04, FINAL_SPLASH: 1.12 }),
})

export type SwimmingPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type SwimmingGameplayPhase = 'WARM_UP' | 'CRUISE' | 'CHASE' | 'FINAL_SPLASH'
export type SwimmingParticipantId = 'PLAYER' | 'STEADY' | 'SURGER' | 'FINISHER'
export type SwimmingStrokeSide = 'LEFT' | 'RIGHT'

export interface SwimmingAcceptedStrokeInput {
  readonly side: SwimmingStrokeSide
  readonly sequence: number
  readonly intensity: number
  readonly vectorY: number
  readonly alternatingStreak: number
}

export interface SwimmingInputSnapshot {
  readonly timestampMs: number
  readonly available: boolean
  readonly propulsion: number
  readonly speedMeter: number
  readonly acceptedStroke?: SwimmingAcceptedStrokeInput
  readonly otherHandHint?: Readonly<{ side: SwimmingStrokeSide; sequence: number }>
}

export interface SwimmingAiSwimmer {
  readonly id: Exclude<SwimmingParticipantId, 'PLAYER'>
  readonly label: string
  readonly basePace: number
  readonly variation: number
  readonly progress: number
}

export interface SwimmingOvertakeEvent {
  readonly swimmerId: Exclude<SwimmingParticipantId, 'PLAYER'>
  readonly atMs: number
  readonly sequence: number
}

export type SwimmingPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: SwimmingGameplayPhase; sequence: number }>
  | Readonly<{ kind: 'FINAL_SPLASH_START'; sequence: number }>
  | Readonly<{ kind: 'STROKE'; side: SwimmingStrokeSide; atMs: number; sequence: number }>
  | Readonly<{ kind: 'OTHER_HAND_HINT'; side: SwimmingStrokeSide; atMs: number; sequence: number }>
  | Readonly<{ kind: 'OVERTAKE'; swimmerId: Exclude<SwimmingParticipantId, 'PLAYER'>; atMs: number; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface SwimmingLatestStroke {
  readonly side: SwimmingStrokeSide
  readonly sequence: number
  readonly intensity: number
  readonly vectorY: number
  readonly atMs: number
}

export interface SwimmingState {
  readonly phase: SwimmingPhase
  readonly swimmingPhase: SwimmingGameplayPhase
  readonly countdownRemainingMs: number
  readonly elapsedMs: number
  readonly roundRemainingMs: number
  readonly playerProgress: number
  readonly playerSpeed: number
  readonly speedMeter: number
  readonly peakSpeedMeter: number
  readonly averageSpeedMeter: number
  readonly acceptedStrokeCount: number
  readonly leftStrokeCount: number
  readonly rightStrokeCount: number
  readonly currentAlternatingStreak: number
  readonly bestAlternatingStreak: number
  readonly latestStroke: SwimmingLatestStroke | null
  readonly aiSwimmers: readonly SwimmingAiSwimmer[]
  readonly ranking: readonly SwimmingParticipantId[]
  readonly playerRank: number
  readonly overtakes: number
  readonly overtakeEvents: readonly SwimmingOvertakeEvent[]
  readonly score: number
  readonly finalPlace: number | null
  readonly presentationEvents: readonly SwimmingPresentationEvent[]
  readonly initialSeed: number
  readonly randomState: number
}

export interface CreateSwimmingStateOptions { readonly seed?: number }
export interface SwimmingFrame { readonly deltaMs: number; readonly input?: SwimmingInputSnapshot }

const DEFAULT_SEED = 0x5357494d
const RANK_TIE_EPSILON = 1e-9
const PARTICIPANT_ORDER: readonly SwimmingParticipantId[] = ['PLAYER', 'STEADY', 'SURGER', 'FINISHER']

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}
function clamp01(value: number): number { return clamp(value, 0, 1) }
function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}
function nextRandom(randomState: number): readonly [number, number] {
  const nextState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return [nextState / 4_294_967_296, nextState]
}

function freezeState(state: SwimmingState): SwimmingState {
  return Object.freeze({
    ...state,
    latestStroke: state.latestStroke ? Object.freeze({ ...state.latestStroke }) : null,
    aiSwimmers: Object.freeze(state.aiSwimmers.map((swimmer) => Object.freeze({ ...swimmer }))),
    ranking: Object.freeze([...state.ranking]),
    overtakeEvents: Object.freeze(state.overtakeEvents.map((event) => Object.freeze({ ...event }))),
    presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze({ ...event }))),
  })
}

export function swimmingPhaseAt(elapsedMs: number): SwimmingGameplayPhase {
  if (elapsedMs >= SWIMMING_RULES.finalSplashStartMs) return 'FINAL_SPLASH'
  if (elapsedMs >= SWIMMING_RULES.chaseStartMs) return 'CHASE'
  if (elapsedMs >= SWIMMING_RULES.cruiseStartMs) return 'CRUISE'
  return 'WARM_UP'
}

function phaseBoundaryAfter(elapsedMs: number): number {
  if (elapsedMs < SWIMMING_RULES.cruiseStartMs) return SWIMMING_RULES.cruiseStartMs
  if (elapsedMs < SWIMMING_RULES.chaseStartMs) return SWIMMING_RULES.chaseStartMs
  if (elapsedMs < SWIMMING_RULES.finalSplashStartMs) return SWIMMING_RULES.finalSplashStartMs
  return SWIMMING_RULES.roundMs
}

export function swimmingAiPaceAt(id: SwimmingAiSwimmer['id'], elapsedMs: number): number {
  if (id === 'STEADY') return 0.62
  if (id === 'SURGER') {
    const surge = (elapsedMs >= 18_000 && elapsedMs < 24_000) ||
      (elapsedMs >= 31_000 && elapsedMs < 37_000) ||
      (elapsedMs >= 44_000 && elapsedMs < 50_000)
    return 0.56 + (surge ? 0.24 : 0)
  }
  return 0.53 + clamp01((elapsedMs - 35_000) / 25_000) * 0.47
}

function createAiSwimmers(seed: number): readonly [readonly SwimmingAiSwimmer[], number] {
  let randomState = seed
  const definitions: readonly [SwimmingAiSwimmer['id'], number][] = [
    ['STEADY', 0.62], ['SURGER', 0.56], ['FINISHER', 0.53],
  ]
  const swimmers = definitions.map(([id, basePace]) => {
    const [variation, nextState] = nextRandom(randomState)
    randomState = nextState
    return Object.freeze({ id, label: id, basePace, variation: 0.97 + variation * 0.06, progress: 0 })
  })
  return [Object.freeze(swimmers), randomState]
}

function rankingFor(playerProgress: number, aiSwimmers: readonly SwimmingAiSwimmer[]): readonly SwimmingParticipantId[] {
  const entries = [
    { id: 'PLAYER' as const, progress: playerProgress, order: 0 },
    ...aiSwimmers.map((swimmer, index) => ({ id: swimmer.id, progress: swimmer.progress, order: index + 1 })),
  ]
  entries.sort((left, right) => {
    const difference = right.progress - left.progress
    return Math.abs(difference) > RANK_TIE_EPSILON ? difference : left.order - right.order
  })
  return entries.map(({ id }) => id)
}

export function createSwimmingState(options: CreateSwimmingStateOptions = {}): SwimmingState {
  const initialSeed = normalizedSeed(options.seed)
  const [aiSwimmers, randomState] = createAiSwimmers(initialSeed)
  return freezeState({
    phase: 'COUNTDOWN', swimmingPhase: 'WARM_UP', countdownRemainingMs: SWIMMING_RULES.countdownMs,
    elapsedMs: 0, roundRemainingMs: SWIMMING_RULES.roundMs, playerProgress: 0, playerSpeed: 0,
    speedMeter: 0, peakSpeedMeter: 0, averageSpeedMeter: 0, acceptedStrokeCount: 0,
    leftStrokeCount: 0, rightStrokeCount: 0, currentAlternatingStreak: 0,
    bestAlternatingStreak: 0, latestStroke: null, aiSwimmers, ranking: PARTICIPANT_ORDER,
    playerRank: 1, overtakes: 0, overtakeEvents: [], score: 0, finalPlace: null,
    presentationEvents: [], initialSeed, randomState,
  })
}

function normalizedInput(input: SwimmingInputSnapshot | undefined): { propulsion: number; speedMeter: number } {
  if (!input?.available) return { propulsion: 0, speedMeter: 0 }
  return { propulsion: clamp01(input.propulsion), speedMeter: Math.round(clamp(input.speedMeter, 0, 100)) }
}

function applyInputEvents(state: SwimmingState, input: SwimmingInputSnapshot | undefined, atMs: number): SwimmingState {
  let next = state
  const stroke = input?.acceptedStroke
  if (stroke && Number.isInteger(stroke.sequence) && stroke.sequence > (state.latestStroke?.sequence ?? 0)) {
    const latestStroke = {
      side: stroke.side,
      sequence: stroke.sequence,
      intensity: clamp01(stroke.intensity),
      vectorY: clamp(stroke.vectorY, -1, 1),
      atMs,
    }
    const currentAlternatingStreak = Math.max(1, Math.trunc(clamp(stroke.alternatingStreak, 1, 1_000_000)))
    next = {
      ...next,
      acceptedStrokeCount: state.acceptedStrokeCount + 1,
      leftStrokeCount: state.leftStrokeCount + (stroke.side === 'LEFT' ? 1 : 0),
      rightStrokeCount: state.rightStrokeCount + (stroke.side === 'RIGHT' ? 1 : 0),
      currentAlternatingStreak,
      bestAlternatingStreak: Math.max(state.bestAlternatingStreak, currentAlternatingStreak),
      latestStroke,
      presentationEvents: [...next.presentationEvents, {
        kind: 'STROKE', side: stroke.side, atMs, sequence: next.presentationEvents.length + 1,
      }],
    }
  }
  if (input?.otherHandHint) {
    next = {
      ...next,
      presentationEvents: [...next.presentationEvents, {
        kind: 'OTHER_HAND_HINT', side: input.otherHandHint.side, atMs,
        sequence: next.presentationEvents.length + 1,
      }],
    }
  }
  return next
}

function addPhaseEvents(state: SwimmingState, previousMs: number, elapsedMs: number): readonly SwimmingPresentationEvent[] {
  let events = state.presentationEvents
  const boundaries: readonly [number, SwimmingGameplayPhase][] = [
    [SWIMMING_RULES.cruiseStartMs, 'CRUISE'],
    [SWIMMING_RULES.chaseStartMs, 'CHASE'],
    [SWIMMING_RULES.finalSplashStartMs, 'FINAL_SPLASH'],
  ]
  for (const [boundary, phase] of boundaries) {
    if (previousMs < boundary && elapsedMs >= boundary) {
      events = [...events, { kind: 'PHASE_START', phase, sequence: events.length + 1 }]
      if (phase === 'FINAL_SPLASH') events = [...events, { kind: 'FINAL_SPLASH_START', sequence: events.length + 1 }]
    }
  }
  return events
}

function updateRanking(state: SwimmingState, atMs: number): SwimmingState {
  const ranking = rankingFor(state.playerProgress, state.aiSwimmers)
  const previousAhead = new Set(state.ranking.slice(0, state.ranking.indexOf('PLAYER')))
  const currentAhead = new Set(ranking.slice(0, ranking.indexOf('PLAYER')))
  const passed = [...previousAhead].filter(
    (id): id is Exclude<SwimmingParticipantId, 'PLAYER'> => id !== 'PLAYER' && !currentAhead.has(id),
  )
  if (passed.length === 0) return { ...state, ranking, playerRank: ranking.indexOf('PLAYER') + 1 }
  const newEvents = passed.map((swimmerId, index) => ({
    swimmerId, atMs, sequence: state.overtakes + index + 1,
  }))
  const presentationEvents = newEvents.reduce<readonly SwimmingPresentationEvent[]>(
    (events, event) => [...events, {
      kind: 'OVERTAKE', swimmerId: event.swimmerId, atMs, sequence: events.length + 1,
    }],
    state.presentationEvents,
  )
  return {
    ...state, ranking, playerRank: ranking.indexOf('PLAYER') + 1,
    overtakes: state.overtakes + newEvents.length,
    overtakeEvents: [...state.overtakeEvents, ...newEvents], presentationEvents,
  }
}

function scoreFor(state: SwimmingState): number {
  const placement = state.finalPlace === null ? 0 : SWIMMING_RULES.placementBonus[state.finalPlace] ?? 0
  return Math.max(0, Math.round(state.playerProgress * SWIMMING_RULES.progressScorePerUnit) +
    state.overtakes * SWIMMING_RULES.overtakeScore + placement)
}

function advanceSegment(state: SwimmingState, deltaMs: number, input: SwimmingInputSnapshot | undefined): SwimmingState {
  if (deltaMs <= 0) return state
  const { propulsion, speedMeter } = normalizedInput(input)
  const playerSpeed = propulsion <= SWIMMING_RULES.propulsionIdleEpsilon ? 0 : clamp(0.18 + propulsion * 0.82, 0, 1)
  const playerProgress = state.playerProgress + playerSpeed * deltaMs / 1_000 * SWIMMING_RULES.playerPhaseScale[state.swimmingPhase]
  const midpointMs = state.elapsedMs + deltaMs / 2
  const aiSwimmers = state.aiSwimmers.map((swimmer) => Object.freeze({
    ...swimmer,
    progress: swimmer.progress + swimmingAiPaceAt(swimmer.id, midpointMs) * swimmer.variation *
      deltaMs / 1_000 * SWIMMING_RULES.aiPhaseScale[state.swimmingPhase],
  }))
  const elapsedMs = state.elapsedMs + deltaMs
  const averageSpeedMeter = elapsedMs === 0 ? 0 :
    (state.averageSpeedMeter * state.elapsedMs + speedMeter * deltaMs) / elapsedMs
  const timed: SwimmingState = {
    ...state, elapsedMs, roundRemainingMs: Math.max(0, SWIMMING_RULES.roundMs - elapsedMs),
    swimmingPhase: swimmingPhaseAt(elapsedMs), playerProgress, playerSpeed, speedMeter,
    peakSpeedMeter: Math.max(state.peakSpeedMeter, speedMeter), averageSpeedMeter, aiSwimmers,
    presentationEvents: addPhaseEvents(state, state.elapsedMs, elapsedMs),
  }
  return updateRanking(timed, elapsedMs)
}

function finishSwimming(state: SwimmingState): SwimmingState {
  if (state.phase === 'FINISHED') return state
  const ranking = rankingFor(state.playerProgress, state.aiSwimmers)
  const finalPlace = ranking.indexOf('PLAYER') + 1
  const result: SwimmingState = {
    ...state, phase: 'FINISHED', elapsedMs: SWIMMING_RULES.roundMs, roundRemainingMs: 0,
    ranking, playerRank: finalPlace, finalPlace, presentationEvents: [...state.presentationEvents, {
      kind: 'ROUND_FINISH', sequence: state.presentationEvents.length + 1,
    }],
  }
  return { ...result, score: scoreFor(result) }
}

function advancePlaying(state: SwimmingState, deltaMs: number, input: SwimmingInputSnapshot | undefined): SwimmingState {
  let current = applyInputEvents(state, input, state.elapsedMs + deltaMs)
  let remainingMs = deltaMs
  while (remainingMs > 0 && current.phase === 'PLAYING') {
    const step = Math.min(
      remainingMs,
      Math.max(0, phaseBoundaryAfter(current.elapsedMs) - current.elapsedMs),
      Math.max(0, SWIMMING_RULES.roundMs - current.elapsedMs),
    )
    current = advanceSegment(current, step, input)
    remainingMs -= step
    if (current.elapsedMs >= SWIMMING_RULES.roundMs) return finishSwimming(current)
    if (step === 0) break
  }
  return { ...current, score: scoreFor(current) }
}

export function advanceSwimming(state: SwimmingState, frame: SwimmingFrame): SwimmingState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  if (state.phase === 'COUNTDOWN') {
    const countdownStep = Math.min(deltaMs, state.countdownRemainingMs)
    const countdownRemainingMs = state.countdownRemainingMs - countdownStep
    const next: SwimmingState = {
      ...state, countdownRemainingMs, phase: countdownRemainingMs === 0 ? 'PLAYING' : 'COUNTDOWN',
    }
    const remainderMs = deltaMs - countdownStep
    return freezeState(remainderMs > 0 ? advancePlaying({ ...next, phase: 'PLAYING' }, remainderMs, frame.input) : next)
  }
  return freezeState(advancePlaying(state, deltaMs, frame.input))
}

export function replaySwimming(state: SwimmingState): SwimmingState {
  return createSwimmingState({ seed: state.initialSeed })
}
