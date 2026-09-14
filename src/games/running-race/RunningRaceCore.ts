export const RUNNING_RACE_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  paceStartMs: 10_000,
  chaseStartMs: 30_000,
  finalSprintStartMs: 50_000,
  playerIdleEpsilon: 0.001,
  progressScorePerUnit: 100,
  overtakeScore: 100,
  placementBonus: Object.freeze({ 1: 500, 2: 300, 3: 150, 4: 0 }) as Readonly<Record<number, number>>,
  playerPhaseScale: Object.freeze({ START: 0.95, PACE: 1, CHASE: 1.03, FINAL_SPRINT: 1.08 }),
  aiPhaseScale: Object.freeze({ START: 0.92, PACE: 1, CHASE: 1.04, FINAL_SPRINT: 1.12 }),
})

export type RunningRacePhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type RunningRaceGameplayPhase = 'START' | 'PACE' | 'CHASE' | 'FINAL_SPRINT'
export type RunningRaceParticipantId = 'PLAYER' | 'STEADY' | 'BURST' | 'FINISHER'
export type RunningStepSide = 'LEFT' | 'RIGHT'

export interface RunningInputSnapshot {
  readonly timestampMs: number
  readonly available: boolean
  readonly intensity: number
  readonly speedMeter: number
  readonly newStepSide?: RunningStepSide
  readonly newStepSequence?: number
}

export interface RunningAiRunner {
  readonly id: Exclude<RunningRaceParticipantId, 'PLAYER'>
  readonly label: string
  readonly basePace: number
  readonly variation: number
  readonly progress: number
}

export interface RunningRankChange {
  readonly runnerId: Exclude<RunningRaceParticipantId, 'PLAYER'>
  readonly atMs: number
  readonly sequence: number
}

export type RunningRacePresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: RunningRaceGameplayPhase; sequence: number }>
  | Readonly<{ kind: 'FINAL_SPRINT_START'; sequence: number }>
  | Readonly<{ kind: 'OVERTAKE'; runnerId: Exclude<RunningRaceParticipantId, 'PLAYER'>; atMs: number; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface RunningLatestStep {
  readonly side: RunningStepSide
  readonly sequence: number
  readonly atMs: number
}

export interface RunningRaceState {
  readonly phase: RunningRacePhase
  readonly racePhase: RunningRaceGameplayPhase
  readonly countdownRemainingMs: number
  readonly elapsedMs: number
  readonly roundRemainingMs: number
  readonly playerProgress: number
  readonly playerSpeed: number
  readonly speedMeter: number
  readonly peakSpeedMeter: number
  readonly averageSpeedMeter: number
  readonly gameSteps: number
  readonly latestStep: RunningLatestStep | null
  readonly aiRunners: readonly RunningAiRunner[]
  readonly ranking: readonly RunningRaceParticipantId[]
  readonly playerRank: number
  readonly overtakes: number
  readonly overtakeEvents: readonly RunningRankChange[]
  readonly score: number
  readonly finalPlace: number | null
  readonly presentationEvents: readonly RunningRacePresentationEvent[]
  readonly initialSeed: number
  readonly randomState: number
}

export interface CreateRunningRaceStateOptions {
  readonly seed?: number
}

export interface RunningRaceFrame {
  readonly deltaMs: number
  readonly input?: RunningInputSnapshot
}

const DEFAULT_SEED = 0x52554e
const RANK_TIE_EPSILON = 1e-9
const PARTICIPANT_ORDER: readonly RunningRaceParticipantId[] = [
  'PLAYER', 'STEADY', 'BURST', 'FINISHER',
]

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

function nextRandom(randomState: number): readonly [number, number] {
  const nextState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return [nextState / 4_294_967_296, nextState]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function runningRacePhaseAt(elapsedMs: number): RunningRaceGameplayPhase {
  if (elapsedMs >= RUNNING_RACE_RULES.finalSprintStartMs) return 'FINAL_SPRINT'
  if (elapsedMs >= RUNNING_RACE_RULES.chaseStartMs) return 'CHASE'
  if (elapsedMs >= RUNNING_RACE_RULES.paceStartMs) return 'PACE'
  return 'START'
}

function phaseBoundaryAfter(elapsedMs: number): number {
  if (elapsedMs < RUNNING_RACE_RULES.paceStartMs) return RUNNING_RACE_RULES.paceStartMs
  if (elapsedMs < RUNNING_RACE_RULES.chaseStartMs) return RUNNING_RACE_RULES.chaseStartMs
  if (elapsedMs < RUNNING_RACE_RULES.finalSprintStartMs) return RUNNING_RACE_RULES.finalSprintStartMs
  return RUNNING_RACE_RULES.roundMs
}

function phaseScale(phase: RunningRaceGameplayPhase): number {
  return RUNNING_RACE_RULES.playerPhaseScale[phase]
}

function aiPhaseScale(phase: RunningRaceGameplayPhase): number {
  return RUNNING_RACE_RULES.aiPhaseScale[phase]
}

function createAiRunners(seed: number): readonly [readonly RunningAiRunner[], number] {
  let randomState = seed
  const definitions: readonly [RunningAiRunner['id'], string, number][] = [
    ['STEADY', 'STEADY', 0.64],
    ['BURST', 'BURST', 0.58],
    ['FINISHER', 'FINISHER', 0.55],
  ]
  const runners = definitions.map(([id, label, basePace]) => {
    const [variation, nextState] = nextRandom(randomState)
    randomState = nextState
    return Object.freeze({
      id,
      label,
      basePace,
      progress: 0,
      variation: 0.97 + variation * 0.06,
    })
  })
  return [Object.freeze(runners), randomState]
}

type InternalAiRunner = RunningAiRunner & { readonly variation: number }

function freezeAiRunner(runner: InternalAiRunner): RunningAiRunner {
  return Object.freeze({
    id: runner.id,
    label: runner.label,
    basePace: runner.basePace,
    variation: runner.variation,
    progress: runner.progress,
  })
}

function freezeState(state: RunningRaceState): RunningRaceState {
  return Object.freeze({
    ...state,
    aiRunners: Object.freeze(state.aiRunners.map((runner) => Object.freeze({ ...runner }))),
    ranking: Object.freeze([...state.ranking]),
    overtakeEvents: Object.freeze(state.overtakeEvents.map((event) => Object.freeze({ ...event }))),
    latestStep: state.latestStep ? Object.freeze({ ...state.latestStep }) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze({ ...event }))),
  })
}

function rankingFor(playerProgress: number, aiRunners: readonly RunningAiRunner[]): readonly RunningRaceParticipantId[] {
  const entries = [
    { id: 'PLAYER' as const, progress: playerProgress, order: 0 },
    ...aiRunners.map((runner, index) => ({ id: runner.id, progress: runner.progress, order: index + 1 })),
  ]
  entries.sort((left, right) => {
    const difference = right.progress - left.progress
    if (Math.abs(difference) > RANK_TIE_EPSILON) return difference
    return left.order - right.order
  })
  return entries.map(({ id }) => id)
}

export function createRunningRaceState(options: CreateRunningRaceStateOptions = {}): RunningRaceState {
  const initialSeed = normalizedSeed(options.seed)
  const [aiRunners, randomState] = createAiRunners(initialSeed)
  return freezeState({
    phase: 'COUNTDOWN',
    racePhase: 'START',
    countdownRemainingMs: RUNNING_RACE_RULES.countdownMs,
    elapsedMs: 0,
    roundRemainingMs: RUNNING_RACE_RULES.roundMs,
    playerProgress: 0,
    playerSpeed: 0,
    speedMeter: 0,
    peakSpeedMeter: 0,
    averageSpeedMeter: 0,
    gameSteps: 0,
    latestStep: null,
    aiRunners,
    ranking: PARTICIPANT_ORDER,
    playerRank: 1,
    overtakes: 0,
    overtakeEvents: [],
    score: 0,
    finalPlace: null,
    presentationEvents: [],
    initialSeed,
    randomState,
  })
}

function normalizedInput(input: RunningInputSnapshot | undefined): {
  readonly intensity: number
  readonly speedMeter: number
} {
  if (!input?.available) return { intensity: 0, speedMeter: 0 }
  const intensity = clamp01(input.intensity)
  return {
    intensity,
    speedMeter: Math.round(clamp(input.speedMeter, 0, 100)),
  }
}

function playerSpeedFor(intensity: number): number {
  if (intensity <= RUNNING_RACE_RULES.playerIdleEpsilon) return 0
  return clamp(0.2 + intensity * 0.8, 0, 1)
}

function paceFor(runner: InternalAiRunner, elapsedMs: number): number {
  if (runner.id === 'BURST') {
    const surgeWindow = Math.floor(elapsedMs / 4_000) % 3 === 1
    return runner.basePace + (surgeWindow ? 0.22 : 0)
  }
  if (runner.id === 'FINISHER') {
    const lateRise = clamp01((elapsedMs - 30_000) / 30_000)
    return runner.basePace + lateRise * 0.45
  }
  return runner.basePace
}

function addPhaseEvents(
  state: RunningRaceState,
  previousElapsedMs: number,
  elapsedMs: number,
): readonly RunningRacePresentationEvent[] {
  let events = state.presentationEvents
  const boundaries: readonly [number, RunningRaceGameplayPhase][] = [
    [RUNNING_RACE_RULES.paceStartMs, 'PACE'],
    [RUNNING_RACE_RULES.chaseStartMs, 'CHASE'],
    [RUNNING_RACE_RULES.finalSprintStartMs, 'FINAL_SPRINT'],
  ]
  for (const [boundary, phase] of boundaries) {
    if (previousElapsedMs < boundary && elapsedMs >= boundary) {
      events = [...events, { kind: 'PHASE_START', phase, sequence: events.length + 1 }]
      if (phase === 'FINAL_SPRINT') {
        events = [...events, { kind: 'FINAL_SPRINT_START', sequence: events.length + 1 }]
      }
    }
  }
  return events
}

function updateRanks(state: RunningRaceState, timestampMs: number): RunningRaceState {
  const ranking = rankingFor(state.playerProgress, state.aiRunners)
  const previousPlayerIndex = state.ranking.indexOf('PLAYER')
  const nextPlayerIndex = ranking.indexOf('PLAYER')
  if (nextPlayerIndex >= previousPlayerIndex) {
    return { ...state, ranking, playerRank: nextPlayerIndex + 1 }
  }
  const newEvents: RunningRankChange[] = []
  for (let index = nextPlayerIndex; index < previousPlayerIndex; index += 1) {
    const runnerId = ranking[index]
    if (runnerId === undefined || runnerId === 'PLAYER') continue
    newEvents.push({
      runnerId,
      atMs: timestampMs,
      sequence: state.overtakes + newEvents.length + 1,
    })
  }
  const presentationEvents = newEvents.reduce<readonly RunningRacePresentationEvent[]>(
    (events, event) => [...events, {
      kind: 'OVERTAKE',
      runnerId: event.runnerId,
      atMs: event.atMs,
      sequence: events.length + 1,
    }],
    state.presentationEvents,
  )
  return {
    ...state,
    ranking,
    playerRank: nextPlayerIndex + 1,
    overtakes: state.overtakes + newEvents.length,
    overtakeEvents: [...state.overtakeEvents, ...newEvents],
    presentationEvents,
  }
}

function scoreFor(state: RunningRaceState): number {
  const placement = state.finalPlace === null ? 0 : RUNNING_RACE_RULES.placementBonus[state.finalPlace] ?? 0
  return Math.max(
    0,
    Math.round(state.playerProgress * RUNNING_RACE_RULES.progressScorePerUnit) +
      state.overtakes * RUNNING_RACE_RULES.overtakeScore + placement,
  )
}

function applyStep(state: RunningRaceState, input: RunningInputSnapshot | undefined, atMs: number): RunningRaceState {
  const side = input?.newStepSide
  const sequence = input?.newStepSequence
  if (
    !side ||
    typeof sequence !== 'number' ||
    !Number.isInteger(sequence) ||
    sequence <= (state.latestStep?.sequence ?? 0)
  ) return state
  return {
    ...state,
    gameSteps: state.gameSteps + 1,
    latestStep: {
      side,
      sequence,
      atMs,
    },
  }
}

function advanceSegment(
  state: RunningRaceState,
  deltaMs: number,
  input: RunningInputSnapshot | undefined,
): RunningRaceState {
  if (deltaMs <= 0) return state
  const { intensity, speedMeter } = normalizedInput(input)
  const playerSpeed = playerSpeedFor(intensity)
  const playerProgress = state.playerProgress +
    playerSpeed * (deltaMs / 1_000) * phaseScale(state.racePhase)
  const midpointMs = state.elapsedMs + deltaMs / 2
  const internalRunners = state.aiRunners as readonly InternalAiRunner[]
  const aiRunners = internalRunners.map((runner) => Object.freeze({
    ...runner,
    progress: runner.progress +
      paceFor(runner, midpointMs) * runner.variation * (deltaMs / 1_000) * aiPhaseScale(state.racePhase),
  }))
  const elapsedMs = state.elapsedMs + deltaMs
  const racePhase = runningRacePhaseAt(elapsedMs)
  const averageSpeedMeter = elapsedMs <= 0
    ? 0
    : (state.averageSpeedMeter * state.elapsedMs + speedMeter * deltaMs) / elapsedMs
  const withTime: RunningRaceState = {
    ...state,
    racePhase,
    elapsedMs,
    roundRemainingMs: Math.max(0, RUNNING_RACE_RULES.roundMs - elapsedMs),
    playerProgress,
    playerSpeed,
    speedMeter,
    peakSpeedMeter: Math.max(state.peakSpeedMeter, speedMeter),
    averageSpeedMeter,
    aiRunners: aiRunners.map(freezeAiRunner),
    presentationEvents: addPhaseEvents(state, state.elapsedMs, elapsedMs),
  }
  return updateRanks(withTime, elapsedMs)
}

function finishRace(state: RunningRaceState): RunningRaceState {
  if (state.phase === 'FINISHED') return state
  const ranking = rankingFor(state.playerProgress, state.aiRunners)
  const finalPlace = ranking.indexOf('PLAYER') + 1
  const withResult = {
    ...state,
    phase: 'FINISHED' as const,
    elapsedMs: RUNNING_RACE_RULES.roundMs,
    roundRemainingMs: 0,
    ranking,
    playerRank: finalPlace,
    finalPlace,
    presentationEvents: [...state.presentationEvents, {
      kind: 'ROUND_FINISH' as const,
      sequence: state.presentationEvents.length + 1,
    }],
  }
  return { ...withResult, score: scoreFor(withResult) }
}

function advancePlaying(
  state: RunningRaceState,
  deltaMs: number,
  input: RunningInputSnapshot | undefined,
): RunningRaceState {
  let current = state
  let remainingMs = deltaMs
  while (remainingMs > 0 && current.phase === 'PLAYING') {
    const untilBoundary = Math.max(0, phaseBoundaryAfter(current.elapsedMs) - current.elapsedMs)
    const untilFinish = Math.max(0, RUNNING_RACE_RULES.roundMs - current.elapsedMs)
    const step = Math.min(remainingMs, untilBoundary, untilFinish)
    current = advanceSegment(current, step, input)
    remainingMs -= step
    if (current.elapsedMs >= RUNNING_RACE_RULES.roundMs) return finishRace(current)
    if (step === 0) break
  }
  return { ...current, score: scoreFor(current) }
}

export function advanceRunningRace(
  state: RunningRaceState,
  frame: RunningRaceFrame,
): RunningRaceState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  if (state.phase === 'COUNTDOWN') {
    const countdownStep = Math.min(deltaMs, state.countdownRemainingMs)
    const countdownRemainingMs = state.countdownRemainingMs - countdownStep
    const next: RunningRaceState = {
      ...state,
      countdownRemainingMs,
      phase: countdownRemainingMs === 0 ? 'PLAYING' : 'COUNTDOWN',
    }
    const playingRemainder = deltaMs - countdownStep
    if (playingRemainder <= 0) return freezeState(next)
    return freezeState(advancePlaying({ ...next, phase: 'PLAYING' }, playingRemainder, frame.input))
  }
  const withStep = applyStep(state, frame.input, state.elapsedMs + deltaMs)
  return freezeState(advancePlaying(withStep, deltaMs, frame.input))
}

export function replayRunningRace(state: RunningRaceState): RunningRaceState {
  return createRunningRaceState({ seed: state.initialSeed })
}
