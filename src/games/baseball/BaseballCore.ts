export const BASEBALL_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  warmUpEndMs: 15_000,
  battingEndMs: 35_000,
  powerInningEndMs: 50_000,
  homeRunRushStartMs: 50_000,
  warmUpSpacingMs: 3_000,
  battingSpacingMs: 2_600,
  powerInningSpacingMs: 2_300,
  homeRunRushSpacingMs: 2_000,
  minimumPitchSpacingMs: 2_000,
  visualLeadMs: 1_800,
  perfectWindowMs: 120,
  greatWindowMs: 240,
  goodWindowMs: 380,
  perfectScore: 150,
  greatScore: 120,
  goodScore: 90,
  singleBonus: 50,
  doubleBonus: 100,
  tripleBonus: 175,
  homeRunBonus: 300,
  powerBonusMax: 30,
  streakTierSize: 5,
  streakBonusPerTier: 10,
  streakBonusCap: 50,
  fieldDirectionThreshold: 0.25,
  minimumHitPower: 0.55,
  maximumHitPower: 1,
  doubleThreshold: 0.68,
  tripleThreshold: 0.78,
  homeRunThreshold: 0.88,
  homeRunMinimumLaunchArc: 0.5,
})

export type BaseballHand = 'LEFT' | 'RIGHT'
export type BaseballPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type BaseballGameplayPhase = 'WARM_UP' | 'BATTING' | 'POWER_INNING' | 'HOME_RUN_RUSH'
export type BaseballPitchType = 'FASTBALL' | 'CURVEBALL' | 'CHANGEUP'
export type BaseballTargetZone = 'HIGH' | 'CENTER' | 'LOW'
export type BaseballPitchResolution = 'PENDING' | 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
export type BaseballContactGrade = Exclude<BaseballPitchResolution, 'PENDING' | 'MISS'>
export type BaseballFieldDirection = 'LEFT_FIELD' | 'CENTER_FIELD' | 'RIGHT_FIELD'
export type BaseballHitResult = 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'HOME_RUN'

export interface BaseballPitch {
  readonly id: number
  readonly type: BaseballPitchType
  readonly targetZone: BaseballTargetZone
  readonly targetTimeMs: number
  readonly resolution: BaseballPitchResolution
}

/** The only normalized swing data Baseball Core accepts. */
export interface BaseballSwingAttempt {
  readonly hand: BaseballHand
  readonly timestampMs: number
  readonly vectorX: number
  readonly vectorY: number
  readonly intensity: number
  readonly sequence: number
}

export interface BaseballHitMetadata {
  readonly pitchId: number
  readonly pitchType: BaseballPitchType
  readonly targetZone: BaseballTargetZone
  readonly hand: BaseballHand
  readonly grade: BaseballContactGrade
  readonly offsetMs: number
  readonly intensity: number
  readonly vectorX: number
  readonly vectorY: number
  readonly hitPower: number
  readonly fieldDirection: BaseballFieldDirection
  readonly launchArc: number
  readonly contactQuality: number
  readonly result: BaseballHitResult
  readonly baseScore: number
  readonly resultBonus: number
  readonly powerBonus: number
  readonly streakBonus: number
  readonly scoreAwarded: number
  readonly resolvedAtMs: number
}

export interface BaseballPitchResult {
  readonly pitchId: number
  readonly resolution: Exclude<BaseballPitchResolution, 'PENDING'>
  readonly resolvedAtMs: number
  readonly scoreAwarded: number
  readonly hit: BaseballHitMetadata | null
}

export type BaseballPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: BaseballGameplayPhase; sequence: number }>
  | Readonly<{ kind: 'CONTACT'; result: BaseballPitchResult; sequence: number }>
  | Readonly<{ kind: 'MISS'; result: BaseballPitchResult; sequence: number }>
  | Readonly<{ kind: 'HOME_RUN'; hit: BaseballHitMetadata; sequence: number }>
  | Readonly<{ kind: 'HOME_RUN_RUSH_START'; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface BaseballState {
  readonly phase: BaseballPhase
  readonly baseballPhase: BaseballGameplayPhase
  readonly countdownRemainingMs: number
  readonly elapsedMs: number
  readonly roundRemainingMs: number
  readonly pitches: readonly BaseballPitch[]
  readonly score: number
  readonly hits: number
  readonly misses: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly singles: number
  readonly doubles: number
  readonly triples: number
  readonly homeRuns: number
  readonly currentStreak: number
  readonly bestStreak: number
  readonly leftHandHits: number
  readonly rightHandHits: number
  readonly lastResult: BaseballPitchResult | null
  readonly lastHit: BaseballHitMetadata | null
  readonly presentationEvents: readonly BaseballPresentationEvent[]
  readonly presentationSequence: number
  readonly randomState: number
  readonly initialSeed: number
}

export interface CreateBaseballStateOptions {
  readonly seed?: number
}

export interface BaseballFrame {
  readonly deltaMs: number
  readonly swingAttempts?: readonly BaseballSwingAttempt[]
}

interface MutableRoundState {
  pitches: BaseballPitch[]
  score: number
  hits: number
  misses: number
  perfectCount: number
  greatCount: number
  goodCount: number
  singles: number
  doubles: number
  triples: number
  homeRuns: number
  currentStreak: number
  bestStreak: number
  leftHandHits: number
  rightHandHits: number
  lastResult: BaseballPitchResult | null
  lastHit: BaseballHitMetadata | null
  presentationEvents: BaseballPresentationEvent[]
  presentationSequence: number
}

const DEFAULT_SEED = 0x42415345
const PITCH_TYPES: readonly BaseballPitchType[] = ['FASTBALL', 'CURVEBALL', 'CHANGEUP']
const TARGET_ZONES: readonly BaseballTargetZone[] = ['HIGH', 'CENTER', 'LOW']

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function clampVector(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0))
}

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

export function baseballPhaseAt(elapsedMs: number): BaseballGameplayPhase {
  if (elapsedMs >= BASEBALL_RULES.homeRunRushStartMs) return 'HOME_RUN_RUSH'
  if (elapsedMs >= BASEBALL_RULES.battingEndMs) return 'POWER_INNING'
  return elapsedMs >= BASEBALL_RULES.warmUpEndMs ? 'BATTING' : 'WARM_UP'
}

export function baseballPitchSpacingAt(targetTimeMs: number): number {
  if (targetTimeMs >= BASEBALL_RULES.homeRunRushStartMs) {
    return BASEBALL_RULES.homeRunRushSpacingMs
  }
  if (targetTimeMs >= BASEBALL_RULES.battingEndMs) {
    return BASEBALL_RULES.powerInningSpacingMs
  }
  if (targetTimeMs >= BASEBALL_RULES.warmUpEndMs) {
    return BASEBALL_RULES.battingSpacingMs
  }
  return BASEBALL_RULES.warmUpSpacingMs
}

export function baseballHitPower(intensity: number): number {
  return BASEBALL_RULES.minimumHitPower + clamp01(intensity) *
    (BASEBALL_RULES.maximumHitPower - BASEBALL_RULES.minimumHitPower)
}

export function baseballFieldDirection(vectorX: number): BaseballFieldDirection {
  const bounded = clampVector(vectorX)
  if (bounded < -BASEBALL_RULES.fieldDirectionThreshold) return 'LEFT_FIELD'
  if (bounded > BASEBALL_RULES.fieldDirectionThreshold) return 'RIGHT_FIELD'
  return 'CENTER_FIELD'
}

export function baseballLaunchArc(vectorY: number): number {
  const safeVectorY = Number.isFinite(vectorY) ? vectorY : 0
  return clamp01(0.5 + -safeVectorY * 0.25)
}

function timingFactor(grade: BaseballContactGrade): number {
  if (grade === 'PERFECT') return 1
  if (grade === 'GREAT') return 0.82
  return 0.65
}

export function baseballContactQuality(
  grade: BaseballContactGrade,
  hitPower: number,
): number {
  return clamp01(timingFactor(grade) * 0.7 + clamp01(hitPower) * 0.3)
}

export function classifyBaseballHit(
  contactQuality: number,
  launchArc: number,
): BaseballHitResult {
  const quality = clamp01(contactQuality)
  const arc = clamp01(launchArc)
  if (
    quality >= BASEBALL_RULES.homeRunThreshold &&
    arc >= BASEBALL_RULES.homeRunMinimumLaunchArc
  ) {
    return 'HOME_RUN'
  }
  if (quality >= BASEBALL_RULES.tripleThreshold) return 'TRIPLE'
  if (quality >= BASEBALL_RULES.doubleThreshold) return 'DOUBLE'
  return 'SINGLE'
}

export function baseballStreakBonus(streak: number): number {
  const safeStreak = Math.max(0, Number.isFinite(streak) ? Math.floor(streak) : 0)
  return Math.min(
    BASEBALL_RULES.streakBonusCap,
    Math.floor(safeStreak / BASEBALL_RULES.streakTierSize) *
      BASEBALL_RULES.streakBonusPerTier,
  )
}

function gradeForOffset(offsetMs: number): BaseballContactGrade | null {
  const absoluteOffset = Math.abs(offsetMs)
  if (absoluteOffset <= BASEBALL_RULES.perfectWindowMs) return 'PERFECT'
  if (absoluteOffset <= BASEBALL_RULES.greatWindowMs) return 'GREAT'
  if (absoluteOffset <= BASEBALL_RULES.goodWindowMs) return 'GOOD'
  return null
}

function baseScoreFor(grade: BaseballContactGrade): number {
  if (grade === 'PERFECT') return BASEBALL_RULES.perfectScore
  if (grade === 'GREAT') return BASEBALL_RULES.greatScore
  return BASEBALL_RULES.goodScore
}

function resultBonusFor(result: BaseballHitResult): number {
  if (result === 'HOME_RUN') return BASEBALL_RULES.homeRunBonus
  if (result === 'TRIPLE') return BASEBALL_RULES.tripleBonus
  if (result === 'DOUBLE') return BASEBALL_RULES.doubleBonus
  return BASEBALL_RULES.singleBonus
}

function generatePitches(seed: number): readonly [readonly BaseballPitch[], number] {
  let randomState = seed
  const [typeOffset, stateAfterType] = randomInt(randomState, 0, PITCH_TYPES.length - 1)
  randomState = stateAfterType
  const [zoneOffset, stateAfterZone] = randomInt(randomState, 0, TARGET_ZONES.length - 1)
  randomState = stateAfterZone
  const pitches: BaseballPitch[] = []
  let targetTimeMs = BASEBALL_RULES.visualLeadMs
  let variedPitchIndex = 0

  while (targetTimeMs < BASEBALL_RULES.roundMs) {
    const type = targetTimeMs < BASEBALL_RULES.warmUpEndMs
      ? 'FASTBALL'
      : PITCH_TYPES[(variedPitchIndex + typeOffset) % PITCH_TYPES.length]!
    const targetZone = TARGET_ZONES[(pitches.length + zoneOffset) % TARGET_ZONES.length]!
    pitches.push(Object.freeze({
      id: pitches.length + 1,
      type,
      targetZone,
      targetTimeMs,
      resolution: 'PENDING' as const,
    }))
    if (targetTimeMs >= BASEBALL_RULES.warmUpEndMs) variedPitchIndex += 1
    targetTimeMs += baseballPitchSpacingAt(targetTimeMs)
  }

  return [Object.freeze(pitches), randomState]
}

function freezePitchResult(result: BaseballPitchResult | null): BaseballPitchResult | null {
  if (!result) return null
  return Object.freeze({
    ...result,
    hit: result.hit ? Object.freeze({ ...result.hit }) : null,
  })
}

function freezeState(state: BaseballState): BaseballState {
  return Object.freeze({
    ...state,
    pitches: Object.freeze(state.pitches.map((pitch) => Object.freeze({ ...pitch }))),
    lastResult: freezePitchResult(state.lastResult),
    lastHit: state.lastHit ? Object.freeze({ ...state.lastHit }) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) =>
      Object.freeze({ ...event }),
    )),
  })
}

export function createBaseballState(
  options: CreateBaseballStateOptions = {},
): BaseballState {
  const initialSeed = normalizedSeed(options.seed)
  const [pitches, randomState] = generatePitches(initialSeed)
  return freezeState({
    phase: 'COUNTDOWN',
    baseballPhase: 'WARM_UP',
    countdownRemainingMs: BASEBALL_RULES.countdownMs,
    elapsedMs: 0,
    roundRemainingMs: BASEBALL_RULES.roundMs,
    pitches,
    score: 0,
    hits: 0,
    misses: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    currentStreak: 0,
    bestStreak: 0,
    leftHandHits: 0,
    rightHandHits: 0,
    lastResult: null,
    lastHit: null,
    presentationEvents: [],
    presentationSequence: 0,
    randomState,
    initialSeed,
  })
}

export function replayBaseball(state: BaseballState): BaseballState {
  return createBaseballState({ seed: state.initialSeed })
}

function mutableFrom(state: BaseballState): MutableRoundState {
  return {
    pitches: state.pitches.map((pitch) => ({ ...pitch })),
    score: state.score,
    hits: state.hits,
    misses: state.misses,
    perfectCount: state.perfectCount,
    greatCount: state.greatCount,
    goodCount: state.goodCount,
    singles: state.singles,
    doubles: state.doubles,
    triples: state.triples,
    homeRuns: state.homeRuns,
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    leftHandHits: state.leftHandHits,
    rightHandHits: state.rightHandHits,
    lastResult: state.lastResult,
    lastHit: state.lastHit,
    presentationEvents: [],
    presentationSequence: state.presentationSequence,
  }
}

function nextPresentationSequence(round: MutableRoundState): number {
  round.presentationSequence += 1
  return round.presentationSequence
}

function resolveMiss(round: MutableRoundState, pitchIndex: number, resolvedAtMs: number): void {
  const pitch = round.pitches[pitchIndex]
  if (!pitch || pitch.resolution !== 'PENDING') return
  round.pitches[pitchIndex] = { ...pitch, resolution: 'MISS' }
  round.misses += 1
  round.currentStreak = 0
  const result = Object.freeze({
    pitchId: pitch.id,
    resolution: 'MISS' as const,
    resolvedAtMs,
    scoreAwarded: 0,
    hit: null,
  })
  round.lastResult = result
  round.presentationEvents.push(Object.freeze({
    kind: 'MISS' as const,
    result,
    sequence: nextPresentationSequence(round),
  }))
}

function resolveExpiredPitches(
  round: MutableRoundState,
  untilMs: number,
  includeAll = false,
): void {
  for (let index = 0; index < round.pitches.length; index += 1) {
    const pitch = round.pitches[index]!
    if (
      pitch.resolution === 'PENDING' &&
      (includeAll || pitch.targetTimeMs + BASEBALL_RULES.goodWindowMs < untilMs)
    ) {
      resolveMiss(
        round,
        index,
        includeAll ? untilMs : pitch.targetTimeMs + BASEBALL_RULES.goodWindowMs,
      )
    }
  }
}

function nearestEligiblePitch(
  pitches: readonly BaseballPitch[],
  attemptAtMs: number,
): number {
  let selectedIndex = -1
  let selectedDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < pitches.length; index += 1) {
    const pitch = pitches[index]!
    if (pitch.resolution !== 'PENDING') continue
    const distance = Math.abs(attemptAtMs - pitch.targetTimeMs)
    if (distance > BASEBALL_RULES.goodWindowMs) continue
    if (
      distance < selectedDistance ||
      (distance === selectedDistance && selectedIndex >= 0 &&
        pitch.targetTimeMs < pitches[selectedIndex]!.targetTimeMs)
    ) {
      selectedIndex = index
      selectedDistance = distance
    }
  }
  return selectedIndex
}

function resolveContact(
  round: MutableRoundState,
  attempt: BaseballSwingAttempt,
): void {
  const pitchIndex = nearestEligiblePitch(round.pitches, attempt.timestampMs)
  if (pitchIndex < 0) return
  const pitch = round.pitches[pitchIndex]!
  const offsetMs = attempt.timestampMs - pitch.targetTimeMs
  const grade = gradeForOffset(offsetMs)
  if (!grade) return

  const intensity = clamp01(attempt.intensity)
  const vectorX = clampVector(attempt.vectorX)
  const vectorY = clampVector(attempt.vectorY)
  const hitPower = baseballHitPower(intensity)
  const fieldDirection = baseballFieldDirection(vectorX)
  const launchArc = baseballLaunchArc(vectorY)
  const contactQuality = baseballContactQuality(grade, hitPower)
  const result = classifyBaseballHit(contactQuality, launchArc)
  const baseScore = baseScoreFor(grade)
  const resultBonus = resultBonusFor(result)
  const powerBonus = Math.round(intensity * BASEBALL_RULES.powerBonusMax)
  const nextStreak = round.currentStreak + 1
  const streakBonus = baseballStreakBonus(nextStreak)
  const scoreAwarded = baseScore + resultBonus + powerBonus + streakBonus
  const hit = Object.freeze({
    pitchId: pitch.id,
    pitchType: pitch.type,
    targetZone: pitch.targetZone,
    hand: attempt.hand,
    grade,
    offsetMs,
    intensity,
    vectorX,
    vectorY,
    hitPower,
    fieldDirection,
    launchArc,
    contactQuality,
    result,
    baseScore,
    resultBonus,
    powerBonus,
    streakBonus,
    scoreAwarded,
    resolvedAtMs: attempt.timestampMs,
  }) satisfies BaseballHitMetadata
  const pitchResult = Object.freeze({
    pitchId: pitch.id,
    resolution: grade,
    resolvedAtMs: attempt.timestampMs,
    scoreAwarded,
    hit,
  }) satisfies BaseballPitchResult

  round.pitches[pitchIndex] = { ...pitch, resolution: grade }
  round.score += scoreAwarded
  round.hits += 1
  round.currentStreak = nextStreak
  round.bestStreak = Math.max(round.bestStreak, nextStreak)
  if (grade === 'PERFECT') round.perfectCount += 1
  else if (grade === 'GREAT') round.greatCount += 1
  else round.goodCount += 1
  if (result === 'SINGLE') round.singles += 1
  else if (result === 'DOUBLE') round.doubles += 1
  else if (result === 'TRIPLE') round.triples += 1
  else round.homeRuns += 1
  if (attempt.hand === 'LEFT') round.leftHandHits += 1
  else round.rightHandHits += 1
  round.lastResult = pitchResult
  round.lastHit = hit
  round.presentationEvents.push(Object.freeze({
    kind: 'CONTACT' as const,
    result: pitchResult,
    sequence: nextPresentationSequence(round),
  }))
  if (result === 'HOME_RUN') {
    round.presentationEvents.push(Object.freeze({
      kind: 'HOME_RUN' as const,
      hit,
      sequence: nextPresentationSequence(round),
    }))
  }
}

function advancePlaying(state: BaseballState, frame: BaseballFrame): BaseballState {
  const safeDeltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  const elapsedMs = Math.min(BASEBALL_RULES.roundMs, state.elapsedMs + safeDeltaMs)
  const round = mutableFrom(state)
  const attempts = [...(frame.swingAttempts ?? [])]
    .filter((attempt) => Number.isFinite(attempt.timestampMs) && attempt.timestampMs <= elapsedMs)
    .sort((left, right) => left.timestampMs - right.timestampMs || left.sequence - right.sequence)

  for (const attempt of attempts) {
    resolveExpiredPitches(round, attempt.timestampMs)
    resolveContact(round, attempt)
  }
  resolveExpiredPitches(round, elapsedMs, elapsedMs >= BASEBALL_RULES.roundMs)

  const previousGameplayPhase = state.baseballPhase
  const baseballPhase = baseballPhaseAt(elapsedMs)
  if (baseballPhase !== previousGameplayPhase) {
    round.presentationEvents.push(Object.freeze({
      kind: 'PHASE_START' as const,
      phase: baseballPhase,
      sequence: nextPresentationSequence(round),
    }))
    if (baseballPhase === 'HOME_RUN_RUSH') {
      round.presentationEvents.push(Object.freeze({
        kind: 'HOME_RUN_RUSH_START' as const,
        sequence: nextPresentationSequence(round),
      }))
    }
  }

  const finished = elapsedMs >= BASEBALL_RULES.roundMs
  if (finished) {
    round.presentationEvents.push(Object.freeze({
      kind: 'ROUND_FINISH' as const,
      sequence: nextPresentationSequence(round),
    }))
  }

  return freezeState({
    ...state,
    ...round,
    phase: finished ? 'FINISHED' : 'PLAYING',
    baseballPhase,
    countdownRemainingMs: 0,
    elapsedMs,
    roundRemainingMs: Math.max(0, BASEBALL_RULES.roundMs - elapsedMs),
  })
}

export function advanceBaseball(
  state: BaseballState,
  frame: BaseballFrame,
): BaseballState {
  if (state.phase === 'FINISHED') return state
  const safeDeltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  if (state.phase === 'PLAYING') {
    return advancePlaying(state, { ...frame, deltaMs: safeDeltaMs })
  }

  if (safeDeltaMs < state.countdownRemainingMs) {
    return freezeState({
      ...state,
      countdownRemainingMs: state.countdownRemainingMs - safeDeltaMs,
      presentationEvents: [],
    })
  }

  const carryMs = safeDeltaMs - state.countdownRemainingMs
  const playing = freezeState({
    ...state,
    phase: 'PLAYING',
    countdownRemainingMs: 0,
    presentationSequence: state.presentationSequence + 1,
    presentationEvents: [Object.freeze({
      kind: 'PHASE_START' as const,
      phase: 'WARM_UP' as const,
      sequence: state.presentationSequence + 1,
    })],
  })
  return carryMs > 0
    ? advancePlaying(playing, { deltaMs: carryMs })
    : playing
}
