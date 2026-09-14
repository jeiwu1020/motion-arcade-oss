export const RUNNER_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  warmUpEndMs: 15_000,
  flowEndMs: 40_000,
  challengeEndMs: 50_000,
  laneTransitionMs: 220,
  jumpDurationMs: 850,
  jumpClearStartMs: 180,
  jumpClearEndMs: 680,
  duckDurationMs: 850,
  duckClearStartMs: 80,
  duckClearEndMs: 760,
  stumbleDurationMs: 520,
  obstacleSuccessScore: 100,
  streakBonusStep: 10,
  streakBonusCap: 50,
  minimumActionRecoverySpacingMs: 1_050,
})

export type RunnerPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type RunnerGameplayPhase = 'WARM_UP' | 'FLOW' | 'CHALLENGE' | 'FINAL_RUSH'
export type RunnerLane = 'LEFT' | 'CENTER' | 'RIGHT'
export type RunnerObstacleType = 'LANE_GATE' | 'LOW_HURDLE' | 'OVERHEAD_GATE'
export type RunnerInputAction = 'MOVE_LEFT' | 'MOVE_RIGHT' | 'JUMP' | 'SQUAT'

export interface RunnerObstacle {
  readonly id: number
  readonly type: RunnerObstacleType
  readonly encounterMs: number
  readonly safeLane: RunnerLane | null
}

export interface RunnerLaneTransition {
  readonly from: RunnerLane
  readonly to: RunnerLane
  readonly elapsedMs: number
  readonly durationMs: number
}

export interface RunnerEncounterResult {
  readonly obstacleId: number
  readonly obstacleType: RunnerObstacleType
  readonly outcome: 'CLEARED' | 'COLLISION'
  readonly scoreAward: number
  readonly atMs: number
}

export type RunnerPresentationEvent =
  | Readonly<{ kind: 'FINAL_RUSH_START'; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface RunnerState {
  readonly phase: RunnerPhase
  readonly gameplayPhase: RunnerGameplayPhase
  readonly countdownRemainingMs: number
  readonly roundRemainingMs: number
  readonly elapsedMs: number
  readonly lane: RunnerLane
  readonly laneTransition: RunnerLaneTransition | null
  readonly jumpElapsedMs: number | null
  readonly duckElapsedMs: number | null
  readonly stumbleRemainingMs: number
  readonly score: number
  readonly obstaclesCleared: number
  readonly collisions: number
  readonly currentStreak: number
  readonly bestStreak: number
  readonly obstacles: readonly RunnerObstacle[]
  readonly nextObstacleIndex: number
  readonly lastEncounter: RunnerEncounterResult | null
  readonly presentationEvents: readonly RunnerPresentationEvent[]
  readonly initialSeed: number
}

export interface CreateRunnerStateOptions {
  readonly seed?: number
}

export interface RunnerFrame {
  readonly deltaMs: number
  readonly actions?: readonly RunnerInputAction[]
}

const DEFAULT_SEED = 0x72756e
const LANES: readonly RunnerLane[] = ['LEFT', 'CENTER', 'RIGHT']
const OBSTACLE_TYPES: readonly RunnerObstacleType[] = [
  'LANE_GATE',
  'LOW_HURDLE',
  'OVERHEAD_GATE',
]

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

function nextRandom(randomState: number): readonly [number, number] {
  const nextState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return [nextState / 4_294_967_296, nextState]
}

function randomInt(
  randomState: number,
  minimum: number,
  maximum: number,
): readonly [number, number] {
  const [unit, nextState] = nextRandom(randomState)
  return [Math.floor(minimum + unit * (maximum - minimum + 1)), nextState]
}

function randomItem<T>(
  randomState: number,
  items: readonly T[],
): readonly [T, number] {
  const [index, nextState] = randomInt(randomState, 0, items.length - 1)
  return [items[index]!, nextState]
}

function intervalRangeAt(elapsedMs: number): readonly [number, number] {
  if (elapsedMs >= RUNNER_RULES.challengeEndMs) return [1_400, 1_750]
  if (elapsedMs >= RUNNER_RULES.flowEndMs) return [1_900, 2_400]
  return [2_500, 3_200]
}

function chooseObstacleType(
  randomState: number,
  obstacles: readonly RunnerObstacle[],
): readonly [RunnerObstacleType, number] {
  const previous = obstacles.at(-1)?.type
  const beforePrevious = obstacles.at(-2)?.type
  const available = previous === beforePrevious
    ? OBSTACLE_TYPES.filter((type) => type !== previous)
    : OBSTACLE_TYPES
  return randomItem(randomState, available)
}

function createObstacle(
  id: number,
  type: RunnerObstacleType,
  encounterMs: number,
  safeLane: RunnerLane | null,
): RunnerObstacle {
  return Object.freeze({ id, type, encounterMs, safeLane })
}

function generateCourse(seed: number): readonly RunnerObstacle[] {
  let randomState = seed
  const [openingLane, stateAfterOpening] = randomItem(randomState, ['LEFT', 'RIGHT'] as const)
  randomState = stateAfterOpening
  const obstacles: RunnerObstacle[] = [
    createObstacle(1, 'LANE_GATE', 5_000, openingLane),
    createObstacle(2, 'LOW_HURDLE', 9_500, null),
    createObstacle(3, 'OVERHEAD_GATE', 14_000, null),
  ]
  let encounterMs = 14_000

  while (encounterMs < RUNNER_RULES.roundMs - 1_400) {
    const [minimumInterval, maximumInterval] = intervalRangeAt(encounterMs)
    const [interval, stateAfterInterval] = randomInt(
      randomState,
      minimumInterval,
      maximumInterval,
    )
    randomState = stateAfterInterval
    encounterMs += Math.max(interval, RUNNER_RULES.minimumActionRecoverySpacingMs)
    if (encounterMs >= RUNNER_RULES.roundMs) break

    const [type, stateAfterType] = chooseObstacleType(randomState, obstacles)
    randomState = stateAfterType
    let safeLane: RunnerLane | null = null
    if (type === 'LANE_GATE') {
      const [selectedLane, stateAfterLane] = randomItem(randomState, LANES)
      safeLane = selectedLane
      randomState = stateAfterLane
    }
    obstacles.push(createObstacle(obstacles.length + 1, type, encounterMs, safeLane))
  }

  return Object.freeze(obstacles)
}

function freezeState(state: RunnerState): RunnerState {
  return Object.freeze({
    ...state,
    laneTransition: state.laneTransition
      ? Object.freeze({ ...state.laneTransition })
      : null,
    obstacles: Object.freeze(
      state.obstacles.map((obstacle) => Object.freeze({ ...obstacle })),
    ),
    lastEncounter: state.lastEncounter
      ? Object.freeze({ ...state.lastEncounter })
      : null,
    presentationEvents: Object.freeze(
      state.presentationEvents.map((event) => Object.freeze({ ...event })),
    ),
  })
}

function gameplayPhaseAt(elapsedMs: number): RunnerGameplayPhase {
  if (elapsedMs >= RUNNER_RULES.challengeEndMs) return 'FINAL_RUSH'
  if (elapsedMs >= RUNNER_RULES.flowEndMs) return 'CHALLENGE'
  if (elapsedMs >= RUNNER_RULES.warmUpEndMs) return 'FLOW'
  return 'WARM_UP'
}

export function createRunnerState(options: CreateRunnerStateOptions = {}): RunnerState {
  const initialSeed = normalizedSeed(options.seed)
  return freezeState({
    phase: 'COUNTDOWN',
    gameplayPhase: 'WARM_UP',
    countdownRemainingMs: RUNNER_RULES.countdownMs,
    roundRemainingMs: RUNNER_RULES.roundMs,
    elapsedMs: 0,
    lane: 'CENTER',
    laneTransition: null,
    jumpElapsedMs: null,
    duckElapsedMs: null,
    stumbleRemainingMs: 0,
    score: 0,
    obstaclesCleared: 0,
    collisions: 0,
    currentStreak: 0,
    bestStreak: 0,
    obstacles: generateCourse(initialSeed),
    nextObstacleIndex: 0,
    lastEncounter: null,
    presentationEvents: [],
    initialSeed,
  })
}

function laneIndex(lane: RunnerLane): number {
  return LANES.indexOf(lane)
}

function moveLane(state: RunnerState, direction: -1 | 1): RunnerState {
  const fromIndex = laneIndex(state.lane)
  const toIndex = Math.max(0, Math.min(LANES.length - 1, fromIndex + direction))
  const to = LANES[toIndex]!
  if (to === state.lane) return state
  return {
    ...state,
    lane: to,
    laneTransition: {
      from: state.lane,
      to,
      elapsedMs: 0,
      durationMs: RUNNER_RULES.laneTransitionMs,
    },
  }
}

function applyActions(
  state: RunnerState,
  actions: readonly RunnerInputAction[],
): RunnerState {
  let current = state
  for (const action of actions) {
    switch (action) {
      case 'MOVE_LEFT':
        current = moveLane(current, -1)
        break
      case 'MOVE_RIGHT':
        current = moveLane(current, 1)
        break
      case 'JUMP':
        if (current.jumpElapsedMs === null && current.duckElapsedMs === null) {
          current = { ...current, jumpElapsedMs: 0 }
        }
        break
      case 'SQUAT':
        if (current.duckElapsedMs === null && current.jumpElapsedMs === null) {
          current = { ...current, duckElapsedMs: 0 }
        }
        break
    }
  }
  return current
}

function advanceOptionalTimer(
  elapsedMs: number | null,
  deltaMs: number,
  durationMs: number,
): number | null {
  if (elapsedMs === null) return null
  const next = elapsedMs + deltaMs
  return next >= durationMs ? null : next
}

function withAdvancedTime(state: RunnerState, deltaMs: number): RunnerState {
  if (deltaMs <= 0) return state
  const elapsedMs = Math.min(RUNNER_RULES.roundMs, state.elapsedMs + deltaMs)
  const crossedFinalRush =
    state.elapsedMs < RUNNER_RULES.challengeEndMs &&
    elapsedMs >= RUNNER_RULES.challengeEndMs
  const presentationEvents = crossedFinalRush
    ? [...state.presentationEvents, {
        kind: 'FINAL_RUSH_START' as const,
        sequence: state.presentationEvents.length + 1,
      }]
    : state.presentationEvents
  const laneTransition = state.laneTransition
    ? state.laneTransition.elapsedMs + deltaMs >= state.laneTransition.durationMs
      ? null
      : {
          ...state.laneTransition,
          elapsedMs: state.laneTransition.elapsedMs + deltaMs,
        }
    : null

  return {
    ...state,
    gameplayPhase: gameplayPhaseAt(elapsedMs),
    elapsedMs,
    roundRemainingMs: Math.max(0, RUNNER_RULES.roundMs - elapsedMs),
    laneTransition,
    jumpElapsedMs: advanceOptionalTimer(
      state.jumpElapsedMs,
      deltaMs,
      RUNNER_RULES.jumpDurationMs,
    ),
    duckElapsedMs: advanceOptionalTimer(
      state.duckElapsedMs,
      deltaMs,
      RUNNER_RULES.duckDurationMs,
    ),
    stumbleRemainingMs: Math.max(0, state.stumbleRemainingMs - deltaMs),
    presentationEvents,
  }
}

function obstacleCleared(state: RunnerState, obstacle: RunnerObstacle): boolean {
  switch (obstacle.type) {
    case 'LANE_GATE':
      return state.lane === obstacle.safeLane
    case 'LOW_HURDLE':
      return state.jumpElapsedMs !== null &&
        state.jumpElapsedMs >= RUNNER_RULES.jumpClearStartMs &&
        state.jumpElapsedMs <= RUNNER_RULES.jumpClearEndMs
    case 'OVERHEAD_GATE':
      return state.duckElapsedMs !== null &&
        state.duckElapsedMs >= RUNNER_RULES.duckClearStartMs &&
        state.duckElapsedMs <= RUNNER_RULES.duckClearEndMs
  }
}

function resolveObstacle(state: RunnerState, obstacle: RunnerObstacle): RunnerState {
  const cleared = obstacleCleared(state, obstacle)
  const nextStreak = cleared ? state.currentStreak + 1 : 0
  const streakBonus = cleared
    ? Math.min(
        RUNNER_RULES.streakBonusCap,
        Math.max(0, nextStreak - 1) * RUNNER_RULES.streakBonusStep,
      )
    : 0
  const scoreAward = cleared
    ? RUNNER_RULES.obstacleSuccessScore + streakBonus
    : 0

  return {
    ...state,
    score: state.score + scoreAward,
    obstaclesCleared: state.obstaclesCleared + (cleared ? 1 : 0),
    collisions: state.collisions + (cleared ? 0 : 1),
    currentStreak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    stumbleRemainingMs: cleared
      ? state.stumbleRemainingMs
      : RUNNER_RULES.stumbleDurationMs,
    nextObstacleIndex: state.nextObstacleIndex + 1,
    lastEncounter: {
      obstacleId: obstacle.id,
      obstacleType: obstacle.type,
      outcome: cleared ? 'CLEARED' : 'COLLISION',
      scoreAward,
      atMs: obstacle.encounterMs,
    },
  }
}

function finishRunner(state: RunnerState): RunnerState {
  if (state.phase === 'FINISHED') return state
  return {
    ...state,
    phase: 'FINISHED',
    elapsedMs: RUNNER_RULES.roundMs,
    roundRemainingMs: 0,
    laneTransition: null,
    jumpElapsedMs: null,
    duckElapsedMs: null,
    stumbleRemainingMs: 0,
    presentationEvents: [...state.presentationEvents, {
      kind: 'ROUND_FINISH',
      sequence: state.presentationEvents.length + 1,
    }],
  }
}

function advancePlaying(state: RunnerState, deltaMs: number): RunnerState {
  let current = state
  let remainingMs = deltaMs
  while (remainingMs > 0 && current.phase === 'PLAYING') {
    const obstacle = current.obstacles[current.nextObstacleIndex]
    const untilObstacle = obstacle
      ? Math.max(0, obstacle.encounterMs - current.elapsedMs)
      : Number.POSITIVE_INFINITY
    const untilFinish = Math.max(0, RUNNER_RULES.roundMs - current.elapsedMs)
    const step = Math.min(remainingMs, untilObstacle, untilFinish)
    current = withAdvancedTime(current, step)
    remainingMs -= step

    if (current.elapsedMs >= RUNNER_RULES.roundMs) {
      return finishRunner(current)
    }
    if (obstacle && current.elapsedMs >= obstacle.encounterMs) {
      current = resolveObstacle(current, obstacle)
      continue
    }
    if (step === 0) break
  }
  return current
}

export function advanceRunner(state: RunnerState, frame: RunnerFrame): RunnerState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)

  if (state.phase === 'COUNTDOWN') {
    const countdownStep = Math.min(deltaMs, state.countdownRemainingMs)
    const countdownRemainingMs = state.countdownRemainingMs - countdownStep
    let current: RunnerState = {
      ...state,
      countdownRemainingMs,
      phase: countdownRemainingMs === 0 ? 'PLAYING' : 'COUNTDOWN',
    }
    const playingRemainder = deltaMs - countdownStep
    if (playingRemainder > 0) current = advancePlaying(current, playingRemainder)
    return freezeState(current)
  }

  const withActions = applyActions(state, frame.actions ?? [])
  return freezeState(advancePlaying(withActions, deltaMs))
}

export function replayRunner(state: RunnerState): RunnerState {
  return createRunnerState({ seed: state.initialSeed })
}
