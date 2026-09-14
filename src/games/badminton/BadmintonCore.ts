export const BADMINTON_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  warmUpEndMs: 15_000,
  rallyEndMs: 35_000,
  smashZoneEndMs: 50_000,
  shuttleRushStartMs: 50_000,
  warmUpSpacingMs: 2_000,
  rallySpacingMs: 1_650,
  smashZoneSpacingMs: 1_450,
  shuttleRushSpacingMs: 1_250,
  minimumShuttleSpacingMs: 1_250,
  visualLeadMs: 1_700,
  clearVisualLeadMs: 1_900,
  perfectWindowMs: 130,
  greatWindowMs: 260,
  goodWindowMs: 420,
  perfectScore: 150,
  greatScore: 120,
  goodScore: 90,
  powerBonusMax: 35,
  smashIntensityThreshold: 0.75,
  smashVectorYThreshold: -0.35,
  smashBonus: 25,
  rallyTierSize: 5,
  rallyBonusPerTier: 10,
  rallyBonusCap: 50,
  directionThreshold: 0.35,
  returnArcMax: 0.85,
})

export type BadmintonHand = 'LEFT' | 'RIGHT'
export type BadmintonPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type BadmintonGameplayPhase = 'WARM_UP' | 'RALLY' | 'SMASH_ZONE' | 'SHUTTLE_RUSH'
export type BadmintonShuttleFamily = 'CLEAR' | 'DRIVE' | 'DROP'
export type BadmintonTargetRegion = 'HIGH_LEFT' | 'HIGH_RIGHT' | 'MID_LEFT' | 'MID_RIGHT'
export type BadmintonShuttleResolution = 'PENDING' | 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
export type BadmintonReturnDirection = 'LEFT' | 'CENTER' | 'RIGHT'

export interface BadmintonShuttle {
  readonly id: number
  readonly family: BadmintonShuttleFamily
  /** Visual target context only; it is not an anatomical hand requirement. */
  readonly targetRegion: BadmintonTargetRegion
  readonly targetTimeMs: number
  readonly resolution: BadmintonShuttleResolution
}

export interface BadmintonSwingAttempt {
  readonly hand: BadmintonHand
  /** Game-local elapsed time, not a camera or Pose timestamp. */
  readonly timestampMs: number
  readonly vectorX: number
  readonly vectorY: number
  readonly intensity: number
  readonly sequence: number
}

export interface BadmintonReturnMetadata {
  readonly shuttleId: number
  readonly hand: BadmintonHand
  readonly grade: Exclude<BadmintonShuttleResolution, 'PENDING' | 'MISS'>
  readonly offsetMs: number
  readonly intensity: number
  readonly powerBonus: number
  readonly rallyBonus: number
  readonly returnDirection: BadmintonReturnDirection
  readonly returnArc: number
  readonly smash: boolean
}

export interface BadmintonHitResult {
  readonly shuttleId: number
  readonly resolution: Exclude<BadmintonShuttleResolution, 'PENDING'>
  readonly scoreAward: number
  readonly resolvedAtMs: number
  readonly attemptAtMs: number | null
  readonly offsetMs: number | null
  readonly hand: BadmintonHand | null
  readonly intensity: number
  readonly returnDirection: BadmintonReturnDirection | null
  readonly returnArc: number | null
  readonly powerBonus: number
  readonly rallyBonus: number
  readonly smashBonus: number
  readonly smash: boolean
}

export type BadmintonPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: BadmintonGameplayPhase; sequence: number }>
  | Readonly<{ kind: 'RETURN'; sequence: number; result: BadmintonHitResult }>
  | Readonly<{ kind: 'MISS'; sequence: number; result: BadmintonHitResult }>
  | Readonly<{ kind: 'SHUTTLE_RUSH_START'; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface BadmintonState {
  readonly phase: BadmintonPhase
  readonly badmintonPhase: BadmintonGameplayPhase
  readonly countdownRemainingMs: number
  readonly elapsedMs: number
  readonly roundRemainingMs: number
  readonly shuttles: readonly BadmintonShuttle[]
  readonly nextShuttleIndex: number
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
  readonly smashCount: number
  readonly lastResult: BadmintonHitResult | null
  readonly lastReturn: BadmintonReturnMetadata | null
  readonly presentationEvents: readonly BadmintonPresentationEvent[]
  readonly randomState: number
  readonly initialSeed: number
}

export interface CreateBadmintonStateOptions {
  readonly seed?: number
}

export interface BadmintonFrame {
  readonly deltaMs: number
  readonly swingAttempts?: readonly BadmintonSwingAttempt[]
}

const DEFAULT_SEED = 0x4241444d
const FAMILIES: readonly BadmintonShuttleFamily[] = ['CLEAR', 'DRIVE', 'DROP']
const REGIONS: readonly BadmintonTargetRegion[] = [
  'HIGH_LEFT',
  'HIGH_RIGHT',
  'MID_LEFT',
  'MID_RIGHT',
]

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

function nextRandom(randomState: number): readonly [number, number] {
  const nextState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return [nextState / 4_294_967_296, nextState]
}

function randomInt(randomState: number, minimum: number, maximum: number): readonly [number, number] {
  const [unit, nextState] = nextRandom(randomState)
  return [Math.floor(minimum + unit * (maximum - minimum + 1)), nextState]
}

export function badmintonPhaseAt(elapsedMs: number): BadmintonGameplayPhase {
  if (elapsedMs >= BADMINTON_RULES.shuttleRushStartMs) return 'SHUTTLE_RUSH'
  if (elapsedMs >= BADMINTON_RULES.rallyEndMs) return 'SMASH_ZONE'
  return elapsedMs >= BADMINTON_RULES.warmUpEndMs ? 'RALLY' : 'WARM_UP'
}

export function badmintonShuttleSpacingAt(targetTimeMs: number): number {
  if (targetTimeMs >= BADMINTON_RULES.shuttleRushStartMs) return BADMINTON_RULES.shuttleRushSpacingMs
  if (targetTimeMs >= BADMINTON_RULES.rallyEndMs) return BADMINTON_RULES.smashZoneSpacingMs
  if (targetTimeMs >= BADMINTON_RULES.warmUpEndMs) return BADMINTON_RULES.rallySpacingMs
  return BADMINTON_RULES.warmUpSpacingMs
}

function createShuttle(
  id: number,
  family: BadmintonShuttleFamily,
  targetRegion: BadmintonTargetRegion,
  targetTimeMs: number,
): BadmintonShuttle {
  return Object.freeze({ id, family, targetRegion, targetTimeMs, resolution: 'PENDING' as const })
}

function generateShuttles(seed: number): readonly [readonly BadmintonShuttle[], number] {
  const shuttles: BadmintonShuttle[] = []
  let randomState = seed
  let targetTimeMs = BADMINTON_RULES.visualLeadMs
  let laterVarietyIndex = 0

  while (targetTimeMs < BADMINTON_RULES.roundMs) {
    let family: BadmintonShuttleFamily
    let targetRegion: BadmintonTargetRegion
    if (shuttles.length === 0) {
      family = 'CLEAR'
      targetRegion = 'HIGH_LEFT'
    } else if (shuttles.length === 1) {
      family = 'CLEAR'
      targetRegion = 'HIGH_RIGHT'
    } else if (shuttles.length === 2) {
      family = 'DRIVE'
      targetRegion = 'MID_LEFT'
    } else if (shuttles.length === 3) {
      family = 'DROP'
      targetRegion = 'MID_RIGHT'
    } else {
      const [randomFamily, stateAfterFamily] = randomInt(randomState, 0, FAMILIES.length - 1)
      randomState = stateAfterFamily
      family = FAMILIES[(randomFamily + laterVarietyIndex) % FAMILIES.length]!
      const [randomRegion, stateAfterRegion] = randomInt(randomState, 0, REGIONS.length - 1)
      randomState = stateAfterRegion
      targetRegion = REGIONS[(randomRegion + laterVarietyIndex) % REGIONS.length]!
      laterVarietyIndex += 1
    }
    shuttles.push(createShuttle(shuttles.length + 1, family, targetRegion, targetTimeMs))
    targetTimeMs += badmintonShuttleSpacingAt(targetTimeMs)
  }

  return [Object.freeze(shuttles), randomState]
}

function freezeState(state: BadmintonState): BadmintonState {
  return Object.freeze({
    ...state,
    shuttles: Object.freeze(state.shuttles.map((shuttle) => Object.freeze({ ...shuttle }))),
    lastResult: state.lastResult ? Object.freeze({ ...state.lastResult }) : null,
    lastReturn: state.lastReturn ? Object.freeze({ ...state.lastReturn }) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) =>
      Object.freeze('result' in event ? { ...event, result: Object.freeze({ ...event.result }) } : { ...event }),
    )),
  })
}

export function createBadmintonState(options: CreateBadmintonStateOptions = {}): BadmintonState {
  const initialSeed = normalizedSeed(options.seed)
  const [shuttles, randomState] = generateShuttles(initialSeed)
  return freezeState({
    phase: 'COUNTDOWN',
    badmintonPhase: 'WARM_UP',
    countdownRemainingMs: BADMINTON_RULES.countdownMs,
    elapsedMs: 0,
    roundRemainingMs: BADMINTON_RULES.roundMs,
    shuttles,
    nextShuttleIndex: 0,
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
    smashCount: 0,
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

function resolutionForOffset(offsetMs: number): Exclude<BadmintonShuttleResolution, 'PENDING' | 'MISS'> {
  const absoluteOffset = Math.abs(offsetMs)
  if (absoluteOffset <= BADMINTON_RULES.perfectWindowMs) return 'PERFECT'
  if (absoluteOffset <= BADMINTON_RULES.greatWindowMs) return 'GREAT'
  return 'GOOD'
}

function scoreForResolution(resolution: Exclude<BadmintonShuttleResolution, 'PENDING' | 'MISS'>): number {
  if (resolution === 'PERFECT') return BADMINTON_RULES.perfectScore
  if (resolution === 'GREAT') return BADMINTON_RULES.greatScore
  return BADMINTON_RULES.goodScore
}

function returnDirectionForVector(vectorX: number): BadmintonReturnDirection {
  const normalizedX = clamp(vectorX, -1, 1)
  if (normalizedX < -BADMINTON_RULES.directionThreshold) return 'LEFT'
  if (normalizedX > BADMINTON_RULES.directionThreshold) return 'RIGHT'
  return 'CENTER'
}

function firstPendingIndex(shuttles: readonly BadmintonShuttle[]): number {
  const index = shuttles.findIndex((shuttle) => shuttle.resolution === 'PENDING')
  return index < 0 ? shuttles.length : index
}

function resolveShuttle(
  state: BadmintonState,
  shuttleIndex: number,
  resolution: Exclude<BadmintonShuttleResolution, 'PENDING'>,
  attempt: BadmintonSwingAttempt | null,
): BadmintonState {
  const shuttle = state.shuttles[shuttleIndex]
  if (!shuttle || shuttle.resolution !== 'PENDING') return state

  const successful = resolution !== 'MISS'
  const attemptAtMs = attempt?.timestampMs ?? null
  const offsetMs = attemptAtMs === null ? null : attemptAtMs - shuttle.targetTimeMs
  const intensity = clamp01(attempt?.intensity ?? 0)
  const currentRally = successful ? state.currentRally + 1 : 0
  const powerBonus = successful ? Math.round(intensity * BADMINTON_RULES.powerBonusMax) : 0
  const rallyBonus = successful
    ? Math.min(
        BADMINTON_RULES.rallyBonusCap,
        Math.floor(currentRally / BADMINTON_RULES.rallyTierSize) * BADMINTON_RULES.rallyBonusPerTier,
      )
    : 0
  const returnDirection = successful && attempt ? returnDirectionForVector(attempt.vectorX) : null
  const returnArc = successful && attempt
    ? clamp(attempt.vectorY, -1, 1) * BADMINTON_RULES.returnArcMax
    : null
  const smash = successful && Boolean(attempt) && intensity >= BADMINTON_RULES.smashIntensityThreshold &&
    (attempt?.vectorY ?? 0) <= BADMINTON_RULES.smashVectorYThreshold
  const smashBonus = smash ? BADMINTON_RULES.smashBonus : 0
  const result: BadmintonHitResult = {
    shuttleId: shuttle.id,
    resolution,
    scoreAward: successful ? scoreForResolution(resolution) + powerBonus + rallyBonus + smashBonus : 0,
    resolvedAtMs: attempt?.timestampMs ?? state.elapsedMs,
    attemptAtMs,
    offsetMs,
    hand: attempt?.hand ?? null,
    intensity,
    returnDirection,
    returnArc,
    powerBonus,
    rallyBonus,
    smashBonus,
    smash,
  }
  const nextShuttles = state.shuttles.map((candidate, index) =>
    index === shuttleIndex ? { ...candidate, resolution } : candidate,
  )
  const nextEvent = successful
    ? { kind: 'RETURN' as const, sequence: state.presentationEvents.length + 1, result }
    : { kind: 'MISS' as const, sequence: state.presentationEvents.length + 1, result }
  return freezeState({
    ...state,
    shuttles: nextShuttles,
    nextShuttleIndex: firstPendingIndex(nextShuttles),
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
    smashCount: state.smashCount + (smash ? 1 : 0),
    lastResult: result,
    lastReturn: successful && attempt
      ? {
          shuttleId: shuttle.id,
          hand: attempt.hand,
          grade: resolution,
          offsetMs: offsetMs ?? 0,
          intensity,
          powerBonus,
          rallyBonus,
          returnDirection: returnDirection ?? 'CENTER',
          returnArc: returnArc ?? 0,
          smash,
        }
      : null,
    presentationEvents: [...state.presentationEvents, nextEvent],
  })
}

function findEligibleShuttle(
  state: BadmintonState,
  attempt: BadmintonSwingAttempt,
): readonly [number, number] | null {
  if (!Number.isFinite(attempt.timestampMs)) return null
  let best: { readonly index: number; readonly offset: number } | null = null
  for (let index = 0; index < state.shuttles.length; index += 1) {
    const shuttle = state.shuttles[index]!
    if (shuttle.resolution !== 'PENDING') continue
    const offset = attempt.timestampMs - shuttle.targetTimeMs
    if (Math.abs(offset) > BADMINTON_RULES.goodWindowMs) continue
    if (!best || Math.abs(offset) < Math.abs(best.offset) ||
      (Math.abs(offset) === Math.abs(best.offset) && shuttle.id < state.shuttles[best.index]!.id)) {
      best = { index, offset }
    }
  }
  return best ? [best.index, best.offset] : null
}

function applyAttempts(state: BadmintonState, attempts: readonly BadmintonSwingAttempt[]): BadmintonState {
  let current = state
  for (const attempt of attempts) {
    const match = findEligibleShuttle(current, attempt)
    if (!match) continue
    current = resolveShuttle(current, match[0], resolutionForOffset(match[1]), attempt)
  }
  return current
}

function expireShuttlesThrough(state: BadmintonState, elapsedMs: number): BadmintonState {
  let current = state
  for (let index = 0; index < current.shuttles.length; index += 1) {
    const shuttle = current.shuttles[index]!
    if (shuttle.resolution === 'PENDING' && elapsedMs > shuttle.targetTimeMs + BADMINTON_RULES.goodWindowMs) {
      current = resolveShuttle(current, index, 'MISS', null)
    }
  }
  return current
}

function appendPhaseEvents(
  state: BadmintonState,
  previousElapsedMs: number,
  elapsedMs: number,
): BadmintonState {
  const boundaries: readonly [number, BadmintonGameplayPhase][] = [
    [BADMINTON_RULES.warmUpEndMs, 'RALLY'],
    [BADMINTON_RULES.rallyEndMs, 'SMASH_ZONE'],
    [BADMINTON_RULES.shuttleRushStartMs, 'SHUTTLE_RUSH'],
  ]
  let events = state.presentationEvents
  for (const [boundary, phase] of boundaries) {
    if (previousElapsedMs < boundary && elapsedMs >= boundary) {
      events = [...events, { kind: 'PHASE_START', phase, sequence: events.length + 1 }]
      if (phase === 'SHUTTLE_RUSH') {
        events = [...events, { kind: 'SHUTTLE_RUSH_START', sequence: events.length + 1 }]
      }
    }
  }
  return events === state.presentationEvents ? state : freezeState({ ...state, presentationEvents: events })
}

function advanceClock(state: BadmintonState, deltaMs: number): BadmintonState {
  if (deltaMs <= 0) return state
  const elapsedMs = Math.min(BADMINTON_RULES.roundMs, state.elapsedMs + deltaMs)
  const withClock = {
    ...state,
    elapsedMs,
    roundRemainingMs: Math.max(0, BADMINTON_RULES.roundMs - elapsedMs),
    badmintonPhase: badmintonPhaseAt(elapsedMs),
  }
  return appendPhaseEvents(freezeState(withClock), state.elapsedMs, elapsedMs)
}

function finishBadminton(state: BadmintonState): BadmintonState {
  let current = expireShuttlesThrough(state, BADMINTON_RULES.roundMs + BADMINTON_RULES.goodWindowMs + 1)
  for (let index = 0; index < current.shuttles.length; index += 1) {
    if (current.shuttles[index]!.resolution === 'PENDING') {
      current = resolveShuttle(current, index, 'MISS', null)
    }
  }
  return freezeState({
    ...current,
    phase: 'FINISHED',
    elapsedMs: BADMINTON_RULES.roundMs,
    roundRemainingMs: 0,
    presentationEvents: [...current.presentationEvents, {
      kind: 'ROUND_FINISH',
      sequence: current.presentationEvents.length + 1,
    }],
  })
}

function advancePlaying(
  state: BadmintonState,
  deltaMs: number,
  attempts: readonly BadmintonSwingAttempt[],
): BadmintonState {
  let current = applyAttempts(state, attempts)
  current = advanceClock(current, deltaMs)
  current = expireShuttlesThrough(current, current.elapsedMs)
  return current.elapsedMs >= BADMINTON_RULES.roundMs ? finishBadminton(current) : freezeState(current)
}

export function advanceBadminton(state: BadmintonState, frame: BadmintonFrame): BadmintonState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  const attempts = frame.swingAttempts ?? []
  if (state.phase === 'COUNTDOWN') {
    const countdownStep = Math.min(deltaMs, state.countdownRemainingMs)
    const countdownRemainingMs = state.countdownRemainingMs - countdownStep
    const next: BadmintonState = {
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

export function replayBadminton(state: BadmintonState): BadmintonState {
  return createBadmintonState({ seed: state.initialSeed })
}
