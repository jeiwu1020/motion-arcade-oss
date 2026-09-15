export const VOCAL_HOP_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  warmUpEndMs: 15_000,
  hopRunEndMs: 35_000,
  skyPathEndMs: 50_000,
  warmUpSpacingMs: 2_600,
  hopRunSpacingMs: 2_200,
  skyPathSpacingMs: 1_900,
  finalHopSpacingMs: 1_700,
  minimumObstacleSpacingMs: 1_700,
  visualLeadMs: 2_200,
  gravity: 2.35,
  baseHopVelocity: -1.05,
  boostWindowMs: 500,
  maximumBoostAcceleration: -1.45,
  maximumAirborneMs: 1_500,
  landingTolerance: 0.025,
  stumbleRecoveryMs: 500,
  lowBlockScore: 100,
  highBlockScore: 150,
  gapScore: 175,
  starScore: 100,
  streakTierSize: 5,
  streakBonusPerTier: 10,
  streakBonusCap: 50,
  maximumSustainedDurationSeconds: 4,
})

export type VocalHopPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type VocalHopGameplayPhase = 'WARM_UP' | 'HOP_RUN' | 'SKY_PATH' | 'FINAL_HOP'
export type VocalHopObstacleType = 'LOW_BLOCK' | 'HIGH_BLOCK' | 'GAP' | 'STAR_GATE'
export type VocalHopObstacleResolution = 'PENDING' | 'CLEARED' | 'STUMBLED' | 'COLLECTED' | 'MISSED'
export type VocalHopHopState = 'GROUNDED' | 'AIRBORNE' | 'STUMBLE'

export interface VocalHopObstacle {
  readonly id: number
  readonly type: VocalHopObstacleType
  readonly targetTimeMs: number
  readonly optional: boolean
  readonly resolution: VocalHopObstacleResolution
}

export interface VocalHopInput {
  readonly triggerSequence?: number
  readonly liftLevel: number
  readonly sustainedDurationSeconds: number
}

export interface VocalHopFrame {
  readonly deltaMs: number
  readonly input?: VocalHopInput
}

export type VocalHopPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: VocalHopGameplayPhase; sequence: number }>
  | Readonly<{ kind: 'HOP_START'; sequence: number }>
  | Readonly<{ kind: 'OBSTACLE_CLEAR'; obstacle: VocalHopObstacle; scoreAwarded: number; sequence: number }>
  | Readonly<{ kind: 'STAR_COLLECT'; obstacle: VocalHopObstacle; scoreAwarded: number; sequence: number }>
  | Readonly<{ kind: 'STUMBLE'; obstacle: VocalHopObstacle; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

type VocalHopPresentationEventInput =
  | Readonly<{ kind: 'PHASE_START'; phase: VocalHopGameplayPhase }>
  | Readonly<{ kind: 'HOP_START' }>
  | Readonly<{ kind: 'OBSTACLE_CLEAR'; obstacle: VocalHopObstacle; scoreAwarded: number }>
  | Readonly<{ kind: 'STAR_COLLECT'; obstacle: VocalHopObstacle; scoreAwarded: number }>
  | Readonly<{ kind: 'STUMBLE'; obstacle: VocalHopObstacle }>
  | Readonly<{ kind: 'ROUND_FINISH' }>

export interface VocalHopFinalResult {
  readonly score: number
  readonly requiredClears: number
  readonly stumbles: number
  readonly starsCollected: number
  readonly bestStreak: number
  readonly hops: number
}

export interface VocalHopState {
  readonly phase: VocalHopPhase
  readonly gamePhase: VocalHopGameplayPhase
  readonly countdownRemainingMs: number
  readonly elapsedMs: number
  readonly roundRemainingMs: number
  readonly horizontalProgress: number
  readonly verticalPosition: number
  readonly verticalVelocity: number
  readonly hopState: VocalHopHopState
  readonly airborneElapsedMs: number
  readonly boostElapsedMs: number
  readonly stumbleElapsedMs: number
  readonly course: readonly VocalHopObstacle[]
  readonly score: number
  readonly requiredClears: number
  readonly stumbles: number
  readonly starsCollected: number
  readonly currentStreak: number
  readonly bestStreak: number
  readonly hops: number
  readonly voiceActiveTimeGameValue: number
  readonly voiceLiftLevel: number
  readonly lastConsumedTriggerSequence: number
  readonly presentationEvents: readonly VocalHopPresentationEvent[]
  readonly presentationSequence: number
  readonly finalResult: VocalHopFinalResult | null
  readonly initialSeed: number
}

export interface CreateVocalHopStateOptions {
  readonly seed?: number
}

const DEFAULT_SEED = 0x564f4341
const COURSE_START_MS = VOCAL_HOP_RULES.warmUpSpacingMs
const COURSE_TYPES: readonly VocalHopObstacleType[] = ['LOW_BLOCK', 'HIGH_BLOCK', 'GAP']

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function safeDeltaMs(value: number): number {
  return Math.max(0, safeNumber(value))
}

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

function nextRandom(state: number): readonly [number, number] {
  const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
  return [next / 4_294_967_296, next]
}

function phaseForElapsed(elapsedMs: number): VocalHopGameplayPhase {
  if (elapsedMs >= VOCAL_HOP_RULES.skyPathEndMs) return 'FINAL_HOP'
  if (elapsedMs >= VOCAL_HOP_RULES.hopRunEndMs) return 'SKY_PATH'
  if (elapsedMs >= VOCAL_HOP_RULES.warmUpEndMs) return 'HOP_RUN'
  return 'WARM_UP'
}

export function vocalHopPhaseAt(elapsedMs: number): VocalHopGameplayPhase {
  return phaseForElapsed(Math.max(0, safeNumber(elapsedMs)))
}

export function vocalHopSpacingAt(targetTimeMs: number): number {
  const phase = phaseForElapsed(targetTimeMs)
  if (phase === 'FINAL_HOP') return VOCAL_HOP_RULES.finalHopSpacingMs
  if (phase === 'SKY_PATH') return VOCAL_HOP_RULES.skyPathSpacingMs
  if (phase === 'HOP_RUN') return VOCAL_HOP_RULES.hopRunSpacingMs
  return VOCAL_HOP_RULES.warmUpSpacingMs
}

/** Comfortable game-local loudness shaping: useful lift arrives before saturation. */
export function vocalHopLiftLevel(voiceLevel: number): number {
  const usable = clamp01((safeNumber(voiceLevel) - 0.1) / (0.55 - 0.1))
  return Math.sqrt(usable)
}

export function vocalHopStreakBonus(streak: number): number {
  const safeStreak = Math.max(0, Math.floor(safeNumber(streak)))
  return Math.min(
    VOCAL_HOP_RULES.streakBonusCap,
    Math.floor(safeStreak / VOCAL_HOP_RULES.streakTierSize) * VOCAL_HOP_RULES.streakBonusPerTier,
  )
}

function scoreForObstacle(type: VocalHopObstacleType): number {
  if (type === 'LOW_BLOCK') return VOCAL_HOP_RULES.lowBlockScore
  if (type === 'HIGH_BLOCK') return VOCAL_HOP_RULES.highBlockScore
  if (type === 'GAP') return VOCAL_HOP_RULES.gapScore
  return VOCAL_HOP_RULES.starScore
}

/** Seeded course data; the first four encounters intentionally teach the verbs. */
export function generateVocalHopCourse(seed: number): readonly VocalHopObstacle[] {
  let randomState = normalizedSeed(seed)
  let targetTimeMs = COURSE_START_MS
  let obstacleIndex = 0
  let previousRequired: VocalHopObstacleType | undefined
  const course: VocalHopObstacle[] = []
  const warmUpTypes: readonly VocalHopObstacleType[] = ['LOW_BLOCK', 'LOW_BLOCK', 'GAP', 'HIGH_BLOCK']

  while (targetTimeMs < VOCAL_HOP_RULES.roundMs) {
    let type: VocalHopObstacleType
    if (obstacleIndex < warmUpTypes.length) {
      type = warmUpTypes[obstacleIndex]!
    } else {
      const [unit, nextState] = nextRandom(randomState)
      randomState = nextState
      const addStar = obstacleIndex % 6 === 0
      if (addStar) {
        type = 'STAR_GATE'
      } else {
        let candidate = COURSE_TYPES[Math.floor(unit * COURSE_TYPES.length)]!
        if (candidate === previousRequired) {
          candidate = COURSE_TYPES[(COURSE_TYPES.indexOf(candidate) + 1) % COURSE_TYPES.length]!
        }
        type = candidate
        previousRequired = type
      }
    }
    const optional = type === 'STAR_GATE'
    course.push(Object.freeze({
      id: obstacleIndex + 1,
      type,
      targetTimeMs,
      optional,
      resolution: 'PENDING',
    }))
    obstacleIndex += 1
    targetTimeMs += vocalHopSpacingAt(targetTimeMs)
  }
  return Object.freeze(course)
}

function freezeState(state: VocalHopState): VocalHopState {
  return Object.freeze({
    ...state,
    course: Object.freeze(state.course.map((obstacle) => Object.freeze({ ...obstacle }))),
    presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze({ ...event }))),
    finalResult: state.finalResult ? Object.freeze({ ...state.finalResult }) : null,
  })
}

function eventSequence(state: VocalHopState): number {
  return state.presentationSequence + 1
}

function addEvent(state: VocalHopState, event: VocalHopPresentationEventInput): VocalHopState {
  const sequence = eventSequence(state)
  return {
    ...state,
    presentationSequence: sequence,
    presentationEvents: [...state.presentationEvents, Object.freeze({ ...event, sequence }) as VocalHopPresentationEvent],
  }
}

export function createVocalHopState(options: CreateVocalHopStateOptions = {}): VocalHopState {
  const initialSeed = normalizedSeed(options.seed)
  return freezeState({
    phase: 'COUNTDOWN',
    gamePhase: 'WARM_UP',
    countdownRemainingMs: VOCAL_HOP_RULES.countdownMs,
    elapsedMs: 0,
    roundRemainingMs: VOCAL_HOP_RULES.roundMs,
    horizontalProgress: 0,
    verticalPosition: 0,
    verticalVelocity: 0,
    hopState: 'GROUNDED',
    airborneElapsedMs: 0,
    boostElapsedMs: 0,
    stumbleElapsedMs: 0,
    course: generateVocalHopCourse(initialSeed),
    score: 0,
    requiredClears: 0,
    stumbles: 0,
    starsCollected: 0,
    currentStreak: 0,
    bestStreak: 0,
    hops: 0,
    voiceActiveTimeGameValue: 0,
    voiceLiftLevel: 0,
    lastConsumedTriggerSequence: 0,
    presentationEvents: [],
    presentationSequence: 0,
    finalResult: null,
    initialSeed,
  })
}

export function replayVocalHop(state: VocalHopState): VocalHopState {
  return createVocalHopState({ seed: state.initialSeed })
}

function launchHop(state: VocalHopState): VocalHopState {
  if (state.hopState !== 'GROUNDED') return state
  return addEvent({
    ...state,
    hopState: 'AIRBORNE',
    verticalVelocity: VOCAL_HOP_RULES.baseHopVelocity,
    verticalPosition: -VOCAL_HOP_RULES.landingTolerance,
    airborneElapsedMs: 0,
    boostElapsedMs: 0,
    stumbleElapsedMs: 0,
    hops: state.hops + 1,
  }, { kind: 'HOP_START' })
}

function simulatePhysics(state: VocalHopState, deltaMs: number, input: VocalHopInput): VocalHopState {
  if (deltaMs <= 0) return state
  const seconds = deltaMs / 1_000
  const liftLevel = clamp01(input.liftLevel)
  const speed = state.gamePhase === 'FINAL_HOP' ? 1.18 : state.gamePhase === 'SKY_PATH' ? 1.05 : state.gamePhase === 'HOP_RUN' ? 0.94 : 0.82
  let next: VocalHopState = {
    ...state,
    elapsedMs: state.elapsedMs + deltaMs,
    horizontalProgress: state.horizontalProgress + speed * seconds,
    voiceActiveTimeGameValue: Math.min(
      VOCAL_HOP_RULES.roundMs / 1_000,
      state.voiceActiveTimeGameValue + (liftLevel > 0 ? seconds : 0),
    ),
  }
  if (state.hopState === 'STUMBLE') {
    const stumbleElapsedMs = state.stumbleElapsedMs + deltaMs
    if (stumbleElapsedMs >= VOCAL_HOP_RULES.stumbleRecoveryMs) {
      return {
        ...next,
        hopState: 'GROUNDED',
        stumbleElapsedMs: VOCAL_HOP_RULES.stumbleRecoveryMs,
      }
    }
    return { ...next, stumbleElapsedMs }
  }
  if (state.hopState !== 'AIRBORNE') return next

  const boostStepMs = Math.max(0, Math.min(deltaMs, VOCAL_HOP_RULES.boostWindowMs - state.boostElapsedMs))
  const normalStepMs = deltaMs - boostStepMs
  const acceleration = VOCAL_HOP_RULES.gravity + VOCAL_HOP_RULES.maximumBoostAcceleration * liftLevel
  const boostedVelocity = state.verticalVelocity + acceleration * (boostStepMs / 1_000)
  const boostedPosition = state.verticalPosition + (state.verticalVelocity + boostedVelocity) * 0.5 * (boostStepMs / 1_000)
  const velocity = boostedVelocity + VOCAL_HOP_RULES.gravity * (normalStepMs / 1_000)
  const position = boostedPosition + (boostedVelocity + velocity) * 0.5 * (normalStepMs / 1_000)
  const airborneElapsedMs = state.airborneElapsedMs + deltaMs
  const landed = position >= -VOCAL_HOP_RULES.landingTolerance || airborneElapsedMs >= VOCAL_HOP_RULES.maximumAirborneMs
  return {
    ...next,
    hopState: landed ? 'GROUNDED' : 'AIRBORNE',
    verticalPosition: landed ? 0 : position,
    verticalVelocity: landed ? 0 : velocity,
    airborneElapsedMs: landed ? 0 : airborneElapsedMs,
    boostElapsedMs: Math.min(VOCAL_HOP_RULES.boostWindowMs, state.boostElapsedMs + boostStepMs),
  }
}

function canClear(obstacle: VocalHopObstacle, state: VocalHopState, input: VocalHopInput): boolean {
  if (state.hopState !== 'AIRBORNE') return false
  if (obstacle.type === 'LOW_BLOCK') return state.verticalPosition < -VOCAL_HOP_RULES.landingTolerance
  if (obstacle.type === 'HIGH_BLOCK') return state.verticalPosition <= -0.25
  if (obstacle.type === 'GAP') {
    return state.verticalPosition <= -0.16 && (state.airborneElapsedMs >= 250 || input.sustainedDurationSeconds >= 0.5)
  }
  return state.verticalPosition <= -0.3 && input.sustainedDurationSeconds >= 0.5
}

function resolveObstacle(state: VocalHopState, index: number, input: VocalHopInput): VocalHopState {
  const obstacle = state.course[index]
  if (!obstacle || obstacle.resolution !== 'PENDING') return state
  const clear = canClear(obstacle, state, input)
  const nextCourse = state.course.map((candidate, candidateIndex) =>
    candidateIndex === index
      ? { ...candidate, resolution: clear ? (obstacle.optional ? 'COLLECTED' : 'CLEARED') : 'MISSED' as VocalHopObstacleResolution }
      : candidate,
  )
  if (obstacle.optional) {
    if (!clear) return { ...state, course: nextCourse }
    return addEvent({
      ...state,
      course: nextCourse,
      score: state.score + VOCAL_HOP_RULES.starScore,
      starsCollected: state.starsCollected + 1,
    }, { kind: 'STAR_COLLECT', obstacle: { ...obstacle, resolution: 'COLLECTED' }, scoreAwarded: VOCAL_HOP_RULES.starScore })
  }
  if (!clear) {
    return addEvent({
      ...state,
      course: nextCourse,
      stumbles: state.stumbles + 1,
      currentStreak: 0,
      hopState: 'STUMBLE',
      verticalPosition: 0,
      verticalVelocity: 0,
      airborneElapsedMs: 0,
      boostElapsedMs: 0,
      stumbleElapsedMs: 0,
    }, { kind: 'STUMBLE', obstacle: { ...obstacle, resolution: 'MISSED' } })
  }
  const requiredClears = state.requiredClears + 1
  const currentStreak = state.currentStreak + 1
  const scoreAwarded = scoreForObstacle(obstacle.type) + vocalHopStreakBonus(currentStreak)
  return addEvent({
    ...state,
    course: nextCourse,
    score: state.score + scoreAwarded,
    requiredClears,
    currentStreak,
    bestStreak: Math.max(state.bestStreak, currentStreak),
  }, { kind: 'OBSTACLE_CLEAR', obstacle: { ...obstacle, resolution: 'CLEARED' }, scoreAwarded })
}

function resolveDueObstacles(state: VocalHopState, input: VocalHopInput): VocalHopState {
  let next = state
  for (let index = 0; index < next.course.length; index += 1) {
    const obstacle = next.course[index]
    if (obstacle && obstacle.resolution === 'PENDING' && obstacle.targetTimeMs <= next.elapsedMs) {
      next = resolveObstacle(next, index, input)
    }
  }
  return next
}

function finishState(state: VocalHopState): VocalHopState {
  const finalResult: VocalHopFinalResult = Object.freeze({
    score: Math.max(0, state.score),
    requiredClears: state.requiredClears,
    stumbles: state.stumbles,
    starsCollected: state.starsCollected,
    bestStreak: state.bestStreak,
    hops: state.hops,
  })
  return addEvent({
    ...state,
    phase: 'FINISHED',
    elapsedMs: VOCAL_HOP_RULES.roundMs,
    roundRemainingMs: 0,
    finalResult,
  }, { kind: 'ROUND_FINISH' })
}

export function advanceVocalHop(state: VocalHopState, frame: VocalHopFrame): VocalHopState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = safeDeltaMs(frame.deltaMs)
  const input: VocalHopInput = {
    liftLevel: clamp01(frame.input?.liftLevel ?? 0),
    sustainedDurationSeconds: Math.max(0, Math.min(VOCAL_HOP_RULES.maximumSustainedDurationSeconds, safeNumber(frame.input?.sustainedDurationSeconds ?? 0))),
    ...(frame.input?.triggerSequence !== undefined ? { triggerSequence: Math.trunc(safeNumber(frame.input.triggerSequence)) } : {}),
  }
  let next: VocalHopState = { ...state, presentationEvents: [], voiceLiftLevel: input.liftLevel }
  const trigger = input.triggerSequence
  if (trigger !== undefined && trigger > next.lastConsumedTriggerSequence) {
    next = { ...next, lastConsumedTriggerSequence: trigger }
    if (next.phase === 'PLAYING') next = launchHop(next)
  }

  let remainingMs = deltaMs
  while (remainingMs > 0 && next.phase !== 'FINISHED') {
    if (next.phase === 'COUNTDOWN') {
      const step = Math.min(remainingMs, next.countdownRemainingMs)
      next = {
        ...next,
        countdownRemainingMs: next.countdownRemainingMs - step,
      }
      remainingMs -= step
      if (next.countdownRemainingMs <= 0) {
        next = addEvent({ ...next, phase: 'PLAYING', countdownRemainingMs: 0 }, { kind: 'PHASE_START', phase: 'WARM_UP' })
      }
      continue
    }
    const nextObstacleTime = next.course.find((obstacle) => obstacle.resolution === 'PENDING')?.targetTimeMs ?? VOCAL_HOP_RULES.roundMs
    const untilObstacle = Math.max(0, nextObstacleTime - next.elapsedMs)
    const untilFinish = Math.max(0, VOCAL_HOP_RULES.roundMs - next.elapsedMs)
    const step = Math.min(remainingMs, untilObstacle > 0 ? untilObstacle : untilFinish)
    if (step <= 0) {
      next = resolveDueObstacles(next, input)
      if (next.elapsedMs >= VOCAL_HOP_RULES.roundMs) {
        next = finishState(next)
      }
      continue
    }
    next = simulatePhysics(next, step, input)
    next = resolveDueObstacles(next, input)
    remainingMs -= step
    const updatedPhase = phaseForElapsed(next.elapsedMs)
    if (updatedPhase !== next.gamePhase) {
      next = addEvent({ ...next, gamePhase: updatedPhase }, { kind: 'PHASE_START', phase: updatedPhase })
    }
    if (next.elapsedMs >= VOCAL_HOP_RULES.roundMs) next = finishState(next)
  }
  if (next.phase === 'PLAYING' && deltaMs === 0) next = resolveDueObstacles(next, input)
  return freezeState(next)
}
