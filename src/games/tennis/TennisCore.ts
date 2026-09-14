export const TENNIS_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  warmUpEndMs: 15_000,
  rallyEndMs: 35_000,
  pressureEndMs: 50_000,
  matchRushStartMs: 50_000,
  warmUpSpacingMs: 2_200,
  rallySpacingMs: 1_900,
  pressureSpacingMs: 1_650,
  matchRushSpacingMs: 1_450,
  minimumShotSpacingMs: 1_450,
  visualLeadMs: 1_800,
  perfectWindowMs: 140,
  greatWindowMs: 280,
  goodWindowMs: 450,
  perfectScore: 150,
  greatScore: 120,
  goodScore: 90,
  powerBonusMax: 40,
  rallyTierSize: 5,
  rallyBonusPerTier: 10,
  rallyBonusCap: 50,
  directionThreshold: 0.35,
  returnArcMax: 0.75,
})

export type TennisHand = 'LEFT' | 'RIGHT'
export type TennisPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type TennisGameplayPhase = 'WARM_UP' | 'RALLY' | 'PRESSURE' | 'MATCH_RUSH'
export type TennisShotType = 'NORMAL' | 'FAST' | 'LOB'
export type TennisIncomingSide = 'LEFT' | 'RIGHT'
export type TennisShotResolution = 'PENDING' | 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
export type TennisReturnDirection = 'LEFT' | 'CENTER' | 'RIGHT'

export interface TennisShot {
  readonly id: number
  readonly type: TennisShotType
  readonly targetTimeMs: number
  /** Visual trajectory context only; it is not an anatomical hand requirement. */
  readonly incomingSide: TennisIncomingSide
  readonly resolution: TennisShotResolution
}

export interface TennisSwingAttempt {
  readonly hand: TennisHand
  /** Game-local elapsed time, not a camera or Pose timestamp. */
  readonly timestampMs: number
  readonly vectorX: number
  readonly vectorY: number
  readonly intensity: number
  readonly sequence: number
}

export interface TennisReturnMetadata {
  readonly shotId: number
  readonly hand: TennisHand
  readonly grade: Exclude<TennisShotResolution, 'PENDING' | 'MISS'>
  readonly offsetMs: number
  readonly intensity: number
  readonly powerBonus: number
  readonly rallyBonus: number
  readonly returnDirection: TennisReturnDirection
  readonly returnArc: number
}

export interface TennisHitResult {
  readonly shotId: number
  readonly resolution: Exclude<TennisShotResolution, 'PENDING'>
  readonly scoreAward: number
  readonly attemptAtMs: number | null
  readonly offsetMs: number | null
  readonly hand: TennisHand | null
  readonly intensity: number
  readonly returnDirection: TennisReturnDirection | null
  readonly returnArc: number | null
  readonly powerBonus: number
  readonly rallyBonus: number
}

export type TennisPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: TennisGameplayPhase; sequence: number }>
  | Readonly<{ kind: 'RETURN'; sequence: number; result: TennisHitResult }>
  | Readonly<{ kind: 'MISS'; sequence: number; result: TennisHitResult }>
  | Readonly<{ kind: 'MATCH_RUSH_START'; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface TennisState {
  readonly phase: TennisPhase
  readonly tennisPhase: TennisGameplayPhase
  readonly countdownRemainingMs: number
  readonly elapsedMs: number
  readonly roundRemainingMs: number
  readonly shots: readonly TennisShot[]
  readonly nextShotIndex: number
  readonly score: number
  readonly returns: number
  readonly misses: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly currentRally: number
  readonly bestRally: number
  readonly leftHandReturns: number
  readonly rightHandReturns: number
  readonly lastResult: TennisHitResult | null
  readonly lastReturn: TennisReturnMetadata | null
  readonly presentationEvents: readonly TennisPresentationEvent[]
  readonly randomState: number
  readonly initialSeed: number
}

export interface CreateTennisStateOptions {
  readonly seed?: number
}

export interface TennisFrame {
  readonly deltaMs: number
  readonly swingAttempts?: readonly TennisSwingAttempt[]
}

const DEFAULT_SEED = 0x54454e4e
const VARIETY: readonly TennisShotType[] = ['NORMAL', 'FAST', 'LOB']

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

export function tennisPhaseAt(elapsedMs: number): TennisGameplayPhase {
  if (elapsedMs >= TENNIS_RULES.matchRushStartMs) return 'MATCH_RUSH'
  if (elapsedMs >= TENNIS_RULES.rallyEndMs) return 'PRESSURE'
  return elapsedMs >= TENNIS_RULES.warmUpEndMs ? 'RALLY' : 'WARM_UP'
}

export function tennisShotSpacingAt(targetTimeMs: number): number {
  if (targetTimeMs >= TENNIS_RULES.matchRushStartMs) return TENNIS_RULES.matchRushSpacingMs
  if (targetTimeMs >= TENNIS_RULES.pressureEndMs) return TENNIS_RULES.pressureSpacingMs
  if (targetTimeMs >= TENNIS_RULES.warmUpEndMs) return TENNIS_RULES.rallySpacingMs
  return TENNIS_RULES.warmUpSpacingMs
}

function createShot(
  id: number,
  type: TennisShotType,
  targetTimeMs: number,
  incomingSide: TennisIncomingSide,
): TennisShot {
  return Object.freeze({ id, type, targetTimeMs, incomingSide, resolution: 'PENDING' as const })
}

function generateShots(seed: number): readonly [readonly TennisShot[], number] {
  const shots: TennisShot[] = []
  let randomState = seed
  let targetTimeMs = TENNIS_RULES.visualLeadMs
  let laterVarietyIndex = 0

  while (targetTimeMs < TENNIS_RULES.roundMs) {
    let type: TennisShotType = 'NORMAL'
    if (targetTimeMs >= TENNIS_RULES.warmUpEndMs) {
      const [randomIndex, stateAfterType] = randomInt(randomState, 0, VARIETY.length - 1)
      randomState = stateAfterType
      type = VARIETY[(randomIndex + laterVarietyIndex) % VARIETY.length]!
      laterVarietyIndex += 1
    }
    const [sideIndex, stateAfterSide] = randomInt(randomState, 0, 1)
    randomState = stateAfterSide
    shots.push(createShot(shots.length + 1, type, targetTimeMs, sideIndex === 0 ? 'LEFT' : 'RIGHT'))
    targetTimeMs += tennisShotSpacingAt(targetTimeMs)
  }

  return [Object.freeze(shots), randomState]
}

function freezeState(state: TennisState): TennisState {
  return Object.freeze({
    ...state,
    shots: Object.freeze(state.shots.map((shot) => Object.freeze({ ...shot }))),
    lastResult: state.lastResult ? Object.freeze({ ...state.lastResult }) : null,
    lastReturn: state.lastReturn ? Object.freeze({ ...state.lastReturn }) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) =>
      Object.freeze('result' in event ? { ...event, result: Object.freeze({ ...event.result }) } : { ...event }),
    )),
  })
}

export function createTennisState(options: CreateTennisStateOptions = {}): TennisState {
  const initialSeed = normalizedSeed(options.seed)
  const [shots, randomState] = generateShots(initialSeed)
  return freezeState({
    phase: 'COUNTDOWN',
    tennisPhase: 'WARM_UP',
    countdownRemainingMs: TENNIS_RULES.countdownMs,
    elapsedMs: 0,
    roundRemainingMs: TENNIS_RULES.roundMs,
    shots,
    nextShotIndex: 0,
    score: 0,
    returns: 0,
    misses: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    currentRally: 0,
    bestRally: 0,
    leftHandReturns: 0,
    rightHandReturns: 0,
    lastResult: null,
    lastReturn: null,
    presentationEvents: [],
    randomState,
    initialSeed,
  })
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : 0))
}

function resolutionForOffset(offsetMs: number): Exclude<TennisShotResolution, 'PENDING' | 'MISS'> {
  const absoluteOffset = Math.abs(offsetMs)
  if (absoluteOffset <= TENNIS_RULES.perfectWindowMs) return 'PERFECT'
  if (absoluteOffset <= TENNIS_RULES.greatWindowMs) return 'GREAT'
  return 'GOOD'
}

function scoreForResolution(resolution: Exclude<TennisShotResolution, 'PENDING' | 'MISS'>): number {
  if (resolution === 'PERFECT') return TENNIS_RULES.perfectScore
  if (resolution === 'GREAT') return TENNIS_RULES.greatScore
  return TENNIS_RULES.goodScore
}

function returnDirectionForVector(vectorX: number): TennisReturnDirection {
  const normalizedX = clamp(vectorX, -1, 1)
  if (normalizedX < -TENNIS_RULES.directionThreshold) return 'LEFT'
  if (normalizedX > TENNIS_RULES.directionThreshold) return 'RIGHT'
  return 'CENTER'
}

function firstPendingIndex(shots: readonly TennisShot[]): number {
  const index = shots.findIndex((shot) => shot.resolution === 'PENDING')
  return index < 0 ? shots.length : index
}

function resolveShot(
  state: TennisState,
  shotIndex: number,
  resolution: Exclude<TennisShotResolution, 'PENDING'>,
  attempt: TennisSwingAttempt | null,
): TennisState {
  const shot = state.shots[shotIndex]
  if (!shot || shot.resolution !== 'PENDING') return state

  const successful = resolution !== 'MISS'
  const attemptAtMs = attempt?.timestampMs ?? null
  const offsetMs = attemptAtMs === null ? null : attemptAtMs - shot.targetTimeMs
  const intensity = clamp01(attempt?.intensity ?? 0)
  const currentRally = successful ? state.currentRally + 1 : 0
  const powerBonus = successful ? Math.round(intensity * TENNIS_RULES.powerBonusMax) : 0
  const rallyBonus = successful
    ? Math.min(
        TENNIS_RULES.rallyBonusCap,
        Math.floor(currentRally / TENNIS_RULES.rallyTierSize) * TENNIS_RULES.rallyBonusPerTier,
      )
    : 0
  const returnDirection = successful && attempt ? returnDirectionForVector(attempt.vectorX) : null
  const returnArc = successful && attempt
    ? clamp(attempt.vectorY, -1, 1) * TENNIS_RULES.returnArcMax
    : null
  const result: TennisHitResult = {
    shotId: shot.id,
    resolution,
    scoreAward: successful ? scoreForResolution(resolution) + powerBonus + rallyBonus : 0,
    attemptAtMs,
    offsetMs,
    hand: attempt?.hand ?? null,
    intensity,
    returnDirection,
    returnArc,
    powerBonus,
    rallyBonus,
  }
  const nextShots = state.shots.map((candidate, index) =>
    index === shotIndex ? { ...candidate, resolution } : candidate,
  )
  const nextEvent = successful
    ? { kind: 'RETURN' as const, sequence: state.presentationEvents.length + 1, result }
    : { kind: 'MISS' as const, sequence: state.presentationEvents.length + 1, result }
  return freezeState({
    ...state,
    shots: nextShots,
    nextShotIndex: firstPendingIndex(nextShots),
    score: Math.max(0, state.score + result.scoreAward),
    returns: state.returns + (successful ? 1 : 0),
    misses: state.misses + (successful ? 0 : 1),
    perfectCount: state.perfectCount + (resolution === 'PERFECT' ? 1 : 0),
    greatCount: state.greatCount + (resolution === 'GREAT' ? 1 : 0),
    goodCount: state.goodCount + (resolution === 'GOOD' ? 1 : 0),
    currentRally,
    bestRally: Math.max(state.bestRally, currentRally),
    leftHandReturns: state.leftHandReturns + (successful && attempt?.hand === 'LEFT' ? 1 : 0),
    rightHandReturns: state.rightHandReturns + (successful && attempt?.hand === 'RIGHT' ? 1 : 0),
    lastResult: result,
    lastReturn: successful && attempt
      ? {
          shotId: shot.id,
          hand: attempt.hand,
          grade: resolution,
          offsetMs: offsetMs ?? 0,
          intensity,
          powerBonus,
          rallyBonus,
          returnDirection: returnDirection ?? 'CENTER',
          returnArc: returnArc ?? 0,
        }
      : null,
    presentationEvents: [...state.presentationEvents, nextEvent],
  })
}

function findEligibleShot(
  state: TennisState,
  attempt: TennisSwingAttempt,
): readonly [number, number] | null {
  const timestampMs = attempt.timestampMs
  if (!Number.isFinite(timestampMs)) return null
  let best: { readonly index: number; readonly offset: number } | null = null
  for (let index = 0; index < state.shots.length; index += 1) {
    const shot = state.shots[index]!
    if (shot.resolution !== 'PENDING') continue
    const offset = timestampMs - shot.targetTimeMs
    if (Math.abs(offset) > TENNIS_RULES.goodWindowMs) continue
    if (!best || Math.abs(offset) < Math.abs(best.offset) ||
      (Math.abs(offset) === Math.abs(best.offset) && shot.id < state.shots[best.index]!.id)) {
      best = { index, offset }
    }
  }
  return best ? [best.index, best.offset] : null
}

function applyAttempts(state: TennisState, attempts: readonly TennisSwingAttempt[]): TennisState {
  let current = state
  for (const attempt of attempts) {
    const match = findEligibleShot(current, attempt)
    if (!match) continue
    current = resolveShot(current, match[0], resolutionForOffset(match[1]), attempt)
  }
  return current
}

function expireShotsThrough(state: TennisState, elapsedMs: number): TennisState {
  let current = state
  for (let index = 0; index < current.shots.length; index += 1) {
    const shot = current.shots[index]!
    if (shot.resolution === 'PENDING' && elapsedMs > shot.targetTimeMs + TENNIS_RULES.goodWindowMs) {
      current = resolveShot(current, index, 'MISS', null)
    }
  }
  return current
}

function appendPhaseEvents(
  state: TennisState,
  previousElapsedMs: number,
  elapsedMs: number,
): TennisState {
  const boundaries: readonly [number, TennisGameplayPhase][] = [
    [TENNIS_RULES.warmUpEndMs, 'RALLY'],
    [TENNIS_RULES.rallyEndMs, 'PRESSURE'],
    [TENNIS_RULES.matchRushStartMs, 'MATCH_RUSH'],
  ]
  let events = state.presentationEvents
  for (const [boundary, phase] of boundaries) {
    if (previousElapsedMs < boundary && elapsedMs >= boundary) {
      events = [...events, {
        kind: 'PHASE_START',
        phase,
        sequence: events.length + 1,
      }]
      if (phase === 'MATCH_RUSH') {
        events = [...events, { kind: 'MATCH_RUSH_START', sequence: events.length + 1 }]
      }
    }
  }
  return events === state.presentationEvents ? state : freezeState({ ...state, presentationEvents: events })
}

function advanceClock(state: TennisState, deltaMs: number): TennisState {
  if (deltaMs <= 0) return state
  const elapsedMs = Math.min(TENNIS_RULES.roundMs, state.elapsedMs + deltaMs)
  const withClock = {
    ...state,
    elapsedMs,
    roundRemainingMs: Math.max(0, TENNIS_RULES.roundMs - elapsedMs),
    tennisPhase: tennisPhaseAt(elapsedMs),
  }
  return appendPhaseEvents(freezeState(withClock), state.elapsedMs, elapsedMs)
}

function finishTennis(state: TennisState): TennisState {
  let current = expireShotsThrough(state, TENNIS_RULES.roundMs + TENNIS_RULES.goodWindowMs + 1)
  for (let index = 0; index < current.shots.length; index += 1) {
    if (current.shots[index]!.resolution === 'PENDING') {
      current = resolveShot(current, index, 'MISS', null)
    }
  }
  return freezeState({
    ...current,
    phase: 'FINISHED',
    elapsedMs: TENNIS_RULES.roundMs,
    roundRemainingMs: 0,
    presentationEvents: [...current.presentationEvents, {
      kind: 'ROUND_FINISH',
      sequence: current.presentationEvents.length + 1,
    }],
  })
}

function advancePlaying(
  state: TennisState,
  deltaMs: number,
  attempts: readonly TennisSwingAttempt[],
): TennisState {
  let current = applyAttempts(state, attempts)
  current = advanceClock(current, deltaMs)
  current = expireShotsThrough(current, current.elapsedMs)
  return current.elapsedMs >= TENNIS_RULES.roundMs ? finishTennis(current) : freezeState(current)
}

export function advanceTennis(state: TennisState, frame: TennisFrame): TennisState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  const attempts = frame.swingAttempts ?? []
  if (state.phase === 'COUNTDOWN') {
    const countdownStep = Math.min(deltaMs, state.countdownRemainingMs)
    const countdownRemainingMs = state.countdownRemainingMs - countdownStep
    const next: TennisState = {
      ...state,
      countdownRemainingMs,
      phase: countdownRemainingMs === 0 ? 'PLAYING' : 'COUNTDOWN',
    }
    const playingRemainder = deltaMs - countdownStep
    return playingRemainder > 0
      ? advancePlaying(freezeState(next), playingRemainder, attempts)
      : freezeState(next)
  }
  return advancePlaying(state, deltaMs, attempts)
}

export function replayTennis(state: TennisState): TennisState {
  return createTennisState({ seed: state.initialSeed })
}
