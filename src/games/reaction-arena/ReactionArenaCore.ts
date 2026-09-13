import type { MotionActionId } from '../../motion/contracts/motion'

export const REACTION_ARENA_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  warmUpEndMs: 15_000,
  reactionRallyEndMs: 28_000,
  specialEventOneEndMs: 34_000,
  comboChainEndMs: 44_000,
  specialEventTwoEndMs: 49_000,
  speedZoneStartMs: 50_000,
  warmUpResponseMs: 1_700,
  reactionRallyResponseMs: 1_350,
  comboChainResponseMs: 1_150,
  specialEventResponseMs: 1_000,
  speedZoneResponseMs: 950,
  interCueGapMs: 375,
  perfectScore: 150,
  greatScore: 125,
  goodScore: 100,
  comboBonusStep: 5,
  comboBonusPerStep: 10,
  comboBonusCap: 50,
})

export type ReactionArenaPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type ReactionArenaGameplayPhase =
  | 'WARM_UP'
  | 'REACTION_RALLY'
  | 'SPECIAL_EVENT_1'
  | 'COMBO_CHAIN'
  | 'SPECIAL_EVENT_2'
  | 'SPEED_ZONE'
export type ReactionArenaCueKind =
  | 'LEFT'
  | 'RIGHT'
  | 'REACH_LEFT'
  | 'REACH_RIGHT'
  | 'SQUAT'
export type ReactionArenaCueState = 'ACTIVE' | 'SUCCESS' | 'EXPIRED'
export type ReactionArenaGrade = 'PERFECT' | 'GREAT' | 'GOOD'
export type ReactionArenaSpecialEvent =
  | 'REACH_BURST'
  | 'SIDE_DASH'
  | 'DUCK_AND_STRIKE'
export type ReactionArenaPatternSet =
  | 'COMBO_CHAIN'
  | 'SPEED_ZONE'
  | 'SPECIAL_EVENT'

export interface ReactionArenaCue {
  readonly id: number
  readonly kind: ReactionArenaCueKind
  readonly state: ReactionArenaCueState
  readonly startTimeMs: number
  readonly responseWindowMs: number
  readonly event: ReactionArenaSpecialEvent | null
}

export interface ReactionArenaActionAttempt {
  readonly action: ReactionArenaCueKind | MotionActionId
  readonly sequence: number
  readonly atMs: number
}

export interface ReactionArenaCueResult {
  readonly cueId: number
  readonly state: 'SUCCESS' | 'EXPIRED'
  readonly kind: ReactionArenaCueKind
  readonly grade: ReactionArenaGrade | null
  readonly score: number
  readonly comboBonus: number
  readonly atMs: number
}

export type ReactionArenaPresentationEvent =
  | Readonly<{ kind: 'SPEED_ZONE_START'; sequence: number }>
  | Readonly<{ kind: 'SPECIAL_EVENT_START'; sequence: number; event: ReactionArenaSpecialEvent }>
  | Readonly<{ kind: 'COMBO_MILESTONE'; sequence: number; value: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface ReactionArenaState {
  readonly phase: ReactionArenaPhase
  readonly gameplayPhase: ReactionArenaGameplayPhase
  readonly countdownRemainingMs: number
  readonly roundRemainingMs: number
  readonly elapsedMs: number
  readonly score: number
  readonly successfulCues: number
  readonly missedCues: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly combo: number
  readonly bestCombo: number
  readonly speedZone: boolean
  readonly currentCue: ReactionArenaCue | null
  readonly lastResult: ReactionArenaCueResult | null
  readonly presentationEvents: readonly ReactionArenaPresentationEvent[]
  readonly specialEvents: readonly ReactionArenaSpecialEvent[]
  readonly specialEventIndexes: Readonly<{ first: number; second: number }>
  readonly nextCueId: number
  readonly randomState: number
  readonly initialSeed: number
  readonly nextCueAtMs: number
  readonly specialCueIndex: number
  readonly activePatternSet: ReactionArenaPatternSet | null
  readonly activePatternId: number | null
  readonly activePatternIndex: number
  readonly activePatternEvent: ReactionArenaSpecialEvent | null
  readonly lastCueKind: ReactionArenaCueKind | null
}

export interface CreateReactionArenaStateOptions {
  readonly seed?: number
}

export interface ReactionArenaFrame {
  readonly deltaMs: number
  readonly actionAttempts?: readonly ReactionArenaActionAttempt[]
}

const DEFAULT_SEED = 0x51f15e
const CUE_POOL: readonly ReactionArenaCueKind[] = [
  'LEFT',
  'RIGHT',
  'REACH_LEFT',
  'REACH_RIGHT',
  'SQUAT',
]
const SPECIAL_EVENTS: readonly ReactionArenaSpecialEvent[] = [
  'REACH_BURST',
  'SIDE_DASH',
  'DUCK_AND_STRIKE',
]

const SPECIAL_CUE_PATTERNS: Readonly<Record<ReactionArenaSpecialEvent, readonly ReactionArenaCueKind[]>> = Object.freeze({
  REACH_BURST: ['REACH_LEFT', 'REACH_RIGHT', 'REACH_RIGHT', 'REACH_LEFT', 'REACH_LEFT', 'REACH_RIGHT'],
  SIDE_DASH: ['LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'RIGHT', 'LEFT'],
  DUCK_AND_STRIKE: ['SQUAT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT', 'REACH_RIGHT'],
})

const CHAIN_PATTERNS: readonly (readonly ReactionArenaCueKind[])[] = [
  ['LEFT', 'REACH_RIGHT'],
  ['RIGHT', 'REACH_LEFT'],
  ['SQUAT', 'REACH_LEFT'],
  ['REACH_RIGHT', 'LEFT'],
]

const SPEED_PATTERNS: readonly (readonly ReactionArenaCueKind[])[] = [
  ['LEFT', 'REACH_RIGHT', 'RIGHT'],
  ['SQUAT', 'REACH_LEFT'],
  ['RIGHT', 'LEFT', 'REACH_RIGHT'],
  ['REACH_LEFT', 'RIGHT'],
]

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

function nextRandom(randomState: number): readonly [number, number] {
  const nextState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return [nextState / 4_294_967_296, nextState]
}

function freezeState(state: ReactionArenaState): ReactionArenaState {
  return Object.freeze({
    ...state,
    currentCue: state.currentCue ? Object.freeze({ ...state.currentCue }) : null,
    lastResult: state.lastResult ? Object.freeze({ ...state.lastResult }) : null,
    presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze({ ...event }))),
    specialEvents: Object.freeze([...state.specialEvents]),
    specialEventIndexes: Object.freeze({ ...state.specialEventIndexes }),
  })
}

function gameplayPhaseAt(elapsedMs: number): ReactionArenaGameplayPhase {
  if (elapsedMs >= REACTION_ARENA_RULES.speedZoneStartMs) return 'SPEED_ZONE'
  if (elapsedMs >= REACTION_ARENA_RULES.comboChainEndMs) return 'SPECIAL_EVENT_2'
  if (elapsedMs >= REACTION_ARENA_RULES.specialEventOneEndMs) return 'COMBO_CHAIN'
  if (elapsedMs >= REACTION_ARENA_RULES.reactionRallyEndMs) return 'SPECIAL_EVENT_1'
  if (elapsedMs >= REACTION_ARENA_RULES.warmUpEndMs) return 'REACTION_RALLY'
  return 'WARM_UP'
}

function responseWindowFor(phase: ReactionArenaGameplayPhase): number {
  switch (phase) {
    case 'WARM_UP': return REACTION_ARENA_RULES.warmUpResponseMs
    case 'REACTION_RALLY': return REACTION_ARENA_RULES.reactionRallyResponseMs
    case 'COMBO_CHAIN': return REACTION_ARENA_RULES.comboChainResponseMs
    case 'SPECIAL_EVENT_1':
    case 'SPECIAL_EVENT_2': return REACTION_ARENA_RULES.specialEventResponseMs
    case 'SPEED_ZONE': return REACTION_ARENA_RULES.speedZoneResponseMs
  }
}

function specialEventFor(state: ReactionArenaState): ReactionArenaSpecialEvent | null {
  if (state.gameplayPhase === 'SPECIAL_EVENT_1') return state.specialEvents[0] ?? null
  if (
    state.gameplayPhase === 'SPECIAL_EVENT_2' &&
    state.elapsedMs < REACTION_ARENA_RULES.specialEventTwoEndMs
  ) {
    return state.specialEvents[1] ?? null
  }
  return null
}

function patternSetForPhase(
  phase: ReactionArenaGameplayPhase,
): readonly (readonly ReactionArenaCueKind[])[] | null {
  if (phase === 'COMBO_CHAIN') return CHAIN_PATTERNS
  if (phase === 'SPEED_ZONE') return SPEED_PATTERNS
  return null
}

export function normalizeReactionArenaAction(action: MotionActionId | ReactionArenaCueKind): ReactionArenaCueKind | null {
  switch (action) {
    case 'LEFT':
    case 'MOVE_LEFT':
    case 'LEAN_LEFT': return 'LEFT'
    case 'RIGHT':
    case 'MOVE_RIGHT':
    case 'LEAN_RIGHT': return 'RIGHT'
    case 'REACH_LEFT': return 'REACH_LEFT'
    case 'REACH_RIGHT': return 'REACH_RIGHT'
    case 'SQUAT': return 'SQUAT'
    default: return null
  }
}

function selectSpecialEvents(randomState: number): readonly [readonly ReactionArenaSpecialEvent[], number] {
  const [firstUnit, stateAfterFirst] = nextRandom(randomState)
  const firstIndex = Math.floor(firstUnit * SPECIAL_EVENTS.length)
  const [secondUnit, stateAfterSecond] = nextRandom(stateAfterFirst)
  const secondOffset = Math.floor(secondUnit * (SPECIAL_EVENTS.length - 1))
  const secondIndex = secondOffset >= firstIndex ? secondOffset + 1 : secondOffset
  return [[SPECIAL_EVENTS[firstIndex]!, SPECIAL_EVENTS[secondIndex]!], stateAfterSecond]
}

export function createReactionArenaState(options: CreateReactionArenaStateOptions = {}): ReactionArenaState {
  const initialSeed = normalizedSeed(options.seed)
  const [specialEvents, randomState] = selectSpecialEvents(initialSeed)
  return freezeState({
    phase: 'COUNTDOWN',
    gameplayPhase: 'WARM_UP',
    countdownRemainingMs: REACTION_ARENA_RULES.countdownMs,
    roundRemainingMs: REACTION_ARENA_RULES.roundMs,
    elapsedMs: 0,
    score: 0,
    successfulCues: 0,
    missedCues: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    combo: 0,
    bestCombo: 0,
    speedZone: false,
    currentCue: null,
    lastResult: null,
    presentationEvents: [],
    specialEvents,
    specialEventIndexes: Object.freeze({ first: 0, second: 1 }),
    nextCueId: 1,
    randomState,
    initialSeed,
    nextCueAtMs: 0,
    specialCueIndex: 0,
    activePatternSet: null,
    activePatternId: null,
    activePatternIndex: 0,
    activePatternEvent: null,
    lastCueKind: null,
  })
}

export function hasReactionArenaCountdownStarted(countdownRemainingMs: number): boolean {
  return countdownRemainingMs < REACTION_ARENA_RULES.countdownMs
}

function chooseRegularCue(state: ReactionArenaState): readonly [ReactionArenaCueKind, number] {
  let randomState = state.randomState
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [unit, nextState] = nextRandom(randomState)
    randomState = nextState
    const candidate = CUE_POOL[Math.floor(unit * CUE_POOL.length)]!
    if (candidate !== state.lastCueKind && !(candidate === 'SQUAT' && state.lastCueKind === 'SQUAT')) {
      return [candidate, randomState]
    }
  }
  return [state.lastCueKind === 'LEFT' ? 'RIGHT' : 'LEFT', randomState]
}

function createCue(state: ReactionArenaState): ReactionArenaState {
  if (
    state.gameplayPhase === 'SPECIAL_EVENT_2' &&
    state.elapsedMs >= REACTION_ARENA_RULES.specialEventTwoEndMs &&
    state.elapsedMs < REACTION_ARENA_RULES.speedZoneStartMs
  ) {
    return freezeState({
      ...state,
      currentCue: null,
      nextCueAtMs: REACTION_ARENA_RULES.speedZoneStartMs,
      specialCueIndex: 0,
      activePatternSet: null,
      activePatternId: null,
      activePatternIndex: 0,
      activePatternEvent: null,
    })
  }

  const event = specialEventFor(state)
  const phase = state.gameplayPhase
  let kind: ReactionArenaCueKind
  let randomState = state.randomState
  let activePatternSet: ReactionArenaPatternSet | null = null
  let activePatternId: number | null = null
  let activePatternIndex = 0
  let activePatternEvent: ReactionArenaSpecialEvent | null = null

  if (event) {
    const pattern = SPECIAL_CUE_PATTERNS[event]
    const reusePattern =
      state.activePatternSet === 'SPECIAL_EVENT' &&
      state.activePatternEvent === event
    activePatternSet = 'SPECIAL_EVENT'
    activePatternId = 0
    activePatternEvent = event
    activePatternIndex = reusePattern
      ? Math.min(state.activePatternIndex, pattern.length - 1)
      : 0
    kind = pattern[activePatternIndex]!
  } else {
    const patternSet = patternSetForPhase(phase)
    if (patternSet) {
      const patternSetName = phase === 'COMBO_CHAIN' ? 'COMBO_CHAIN' : 'SPEED_ZONE'
      const reusePattern =
        state.activePatternSet === patternSetName && state.activePatternId !== null
      activePatternSet = patternSetName
      if (reusePattern) {
        activePatternId = state.activePatternId
      } else {
        const [unit, nextState] = nextRandom(randomState)
        randomState = nextState
        activePatternId = Math.floor(unit * patternSet.length)
      }
      const pattern = patternSet[activePatternId] ?? patternSet[0]!
      activePatternIndex = reusePattern
        ? Math.min(state.activePatternIndex, pattern.length - 1)
        : 0
      kind = pattern[activePatternIndex]!
    } else {
      const [regularKind, nextState] = chooseRegularCue(state)
      kind = regularKind
      randomState = nextState
    }
  }

  const cue: ReactionArenaCue = Object.freeze({
    id: state.nextCueId,
    kind,
    state: 'ACTIVE',
    startTimeMs: state.elapsedMs,
    responseWindowMs: responseWindowFor(phase),
    event,
  })
  const shouldAnnounceEvent =
    event !== null &&
    !(
      state.activePatternSet === 'SPECIAL_EVENT' &&
      state.activePatternEvent === event
    )
  const events: ReactionArenaPresentationEvent[] = shouldAnnounceEvent
    ? [{ kind: 'SPECIAL_EVENT_START', sequence: state.nextCueId, event }]
    : []
  const speedZoneChanged = phase === 'SPEED_ZONE' && !state.speedZone
  if (speedZoneChanged) events.push({ kind: 'SPEED_ZONE_START', sequence: state.nextCueId })
  return freezeState({
    ...state,
    currentCue: cue,
    nextCueId: state.nextCueId + 1,
    randomState,
    specialCueIndex: activePatternIndex,
    activePatternSet,
    activePatternId,
    activePatternIndex,
    activePatternEvent,
    speedZone: state.speedZone || speedZoneChanged,
    presentationEvents: [...state.presentationEvents, ...events],
    lastCueKind: kind,
  })
}

function withElapsed(state: ReactionArenaState, elapsedMs: number): ReactionArenaState {
  const nextElapsed = Math.min(REACTION_ARENA_RULES.roundMs, Math.max(0, elapsedMs))
  const nextGameplayPhase = gameplayPhaseAt(nextElapsed)
  const phaseChanged = nextGameplayPhase !== state.gameplayPhase
  const entersSpecialEventGap =
    state.gameplayPhase === 'SPECIAL_EVENT_2' &&
    state.elapsedMs < REACTION_ARENA_RULES.specialEventTwoEndMs &&
    nextElapsed >= REACTION_ARENA_RULES.specialEventTwoEndMs
  const speedZoneChanged = state.elapsedMs < REACTION_ARENA_RULES.speedZoneStartMs && nextElapsed >= REACTION_ARENA_RULES.speedZoneStartMs && !state.speedZone
  const presentationEvents = speedZoneChanged
    ? [...state.presentationEvents, { kind: 'SPEED_ZONE_START' as const, sequence: state.nextCueId }]
    : state.presentationEvents
  return freezeState({
    ...state,
    elapsedMs: nextElapsed,
    roundRemainingMs: Math.max(0, REACTION_ARENA_RULES.roundMs - nextElapsed),
    gameplayPhase: nextGameplayPhase,
    specialCueIndex: phaseChanged ? 0 : state.specialCueIndex,
    currentCue: entersSpecialEventGap && state.currentCue?.event !== null
      ? null
      : state.currentCue,
    nextCueAtMs: entersSpecialEventGap
      ? REACTION_ARENA_RULES.speedZoneStartMs
      : state.nextCueAtMs,
    activePatternSet: entersSpecialEventGap
      ? null
      : state.activePatternSet,
    activePatternId: entersSpecialEventGap ? null : state.activePatternId,
    activePatternIndex: entersSpecialEventGap ? 0 : state.activePatternIndex,
    activePatternEvent: entersSpecialEventGap ? null : state.activePatternEvent,
    speedZone: state.speedZone || speedZoneChanged,
    presentationEvents,
  })
}

function resolveCue(
  state: ReactionArenaState,
  result: ReactionArenaCueResult,
): ReactionArenaState {
  const successful = result.state === 'SUCCESS'
  const combo = successful ? state.combo + 1 : 0
  const bestCombo = Math.max(state.bestCombo, combo)
  const score = state.score + result.score
  const milestone = successful && combo >= 5 && combo % 5 === 0
  const events: ReactionArenaPresentationEvent[] = milestone
    ? [{ kind: 'COMBO_MILESTONE', sequence: result.cueId, value: combo }]
    : []
  let activePatternSet = state.activePatternSet
  let activePatternId = state.activePatternId
  let activePatternIndex = state.activePatternIndex
  let activePatternEvent = state.activePatternEvent
  const cue = state.currentCue
  if (
    cue?.event &&
    state.activePatternSet === 'SPECIAL_EVENT' &&
    state.activePatternEvent === cue.event
  ) {
    const pattern = SPECIAL_CUE_PATTERNS[cue.event]
    activePatternIndex =
      state.activePatternIndex + 1 >= pattern.length
        ? 0
        : state.activePatternIndex + 1
  } else if (
    cue &&
    !cue.event &&
    (state.activePatternSet === 'COMBO_CHAIN' ||
      state.activePatternSet === 'SPEED_ZONE') &&
    state.activePatternId !== null
  ) {
    const patternSet = patternSetForPhase(state.activePatternSet)
    const pattern = patternSet?.[state.activePatternId]
    if (pattern && state.activePatternIndex + 1 < pattern.length) {
      activePatternIndex = state.activePatternIndex + 1
    } else {
      activePatternSet = null
      activePatternId = null
      activePatternIndex = 0
      activePatternEvent = null
    }
  } else {
    activePatternSet = null
    activePatternId = null
    activePatternIndex = 0
    activePatternEvent = null
  }
  return freezeState({
    ...state,
    score,
    successfulCues: state.successfulCues + (successful ? 1 : 0),
    missedCues: state.missedCues + (successful ? 0 : 1),
    perfectCount: state.perfectCount + (result.grade === 'PERFECT' ? 1 : 0),
    greatCount: state.greatCount + (result.grade === 'GREAT' ? 1 : 0),
    goodCount: state.goodCount + (result.grade === 'GOOD' ? 1 : 0),
    combo,
    bestCombo,
    currentCue: null,
    lastResult: result,
    nextCueAtMs: state.elapsedMs + REACTION_ARENA_RULES.interCueGapMs,
    specialCueIndex: activePatternIndex,
    activePatternSet,
    activePatternId,
    activePatternIndex,
    activePatternEvent,
    presentationEvents: [...state.presentationEvents, ...events],
  })
}

function resolveSuccess(state: ReactionArenaState, attemptAtMs: number): ReactionArenaState {
  const cue = state.currentCue
  if (!cue) return state
  const elapsedInWindow = Math.max(0, attemptAtMs - cue.startTimeMs)
  const fraction = elapsedInWindow / cue.responseWindowMs
  const grade: ReactionArenaGrade = fraction <= 0.4 ? 'PERFECT' : fraction <= 0.7 ? 'GREAT' : 'GOOD'
  const base = grade === 'PERFECT'
    ? REACTION_ARENA_RULES.perfectScore
    : grade === 'GREAT'
      ? REACTION_ARENA_RULES.greatScore
      : REACTION_ARENA_RULES.goodScore
  const nextCombo = state.combo + 1
  const comboBonus = Math.min(
    REACTION_ARENA_RULES.comboBonusCap,
    Math.floor(nextCombo / REACTION_ARENA_RULES.comboBonusStep) * REACTION_ARENA_RULES.comboBonusPerStep,
  )
  return resolveCue(state, {
    cueId: cue.id,
    state: 'SUCCESS',
    kind: cue.kind,
    grade,
    score: base + comboBonus,
    comboBonus,
    atMs: attemptAtMs,
  })
}

function resolveExpired(state: ReactionArenaState): ReactionArenaState {
  const cue = state.currentCue
  if (!cue) return state
  return resolveCue(state, {
    cueId: cue.id,
    state: 'EXPIRED',
    kind: cue.kind,
    grade: null,
    score: 0,
    comboBonus: 0,
    atMs: cue.startTimeMs + cue.responseWindowMs,
  })
}

function finish(state: ReactionArenaState): ReactionArenaState {
  if (state.phase === 'FINISHED') return state
  return freezeState({
    ...withElapsed(state, REACTION_ARENA_RULES.roundMs),
    phase: 'FINISHED',
    currentCue: null,
    presentationEvents: [...state.presentationEvents, { kind: 'ROUND_FINISH', sequence: state.nextCueId }],
  })
}

function advanceTime(state: ReactionArenaState, targetMs: number): ReactionArenaState {
  let current = state
  if (current.phase === 'COUNTDOWN') {
    const available = Math.max(0, targetMs)
    if (available < current.countdownRemainingMs) {
      return freezeState({ ...current, countdownRemainingMs: current.countdownRemainingMs - available })
    }
    const remaining = available - current.countdownRemainingMs
    current = freezeState({ ...current, phase: 'PLAYING', countdownRemainingMs: 0, presentationEvents: [] })
    current = createCue(current)
    if (remaining <= 0) return current
    return advanceTime(current, remaining)
  }
  if (current.phase === 'FINISHED') return current
  let remaining = Math.max(0, targetMs)
  while (remaining > 0 && current.phase === 'PLAYING') {
    const cueExpiry = current.currentCue
      ? Math.max(0, current.currentCue.startTimeMs + current.currentCue.responseWindowMs - current.elapsedMs)
      : Number.POSITIVE_INFINITY
    const cueStart = current.currentCue ? Number.POSITIVE_INFINITY : Math.max(0, current.nextCueAtMs - current.elapsedMs)
    const roundEnd = Math.max(0, REACTION_ARENA_RULES.roundMs - current.elapsedMs)
    const step = Math.min(remaining, cueExpiry, cueStart, roundEnd)
    if (!Number.isFinite(step)) break
    current = withElapsed(current, current.elapsedMs + step)
    remaining -= step
    if (current.elapsedMs >= REACTION_ARENA_RULES.roundMs) return finish(current)
    if (current.currentCue && current.elapsedMs >= current.currentCue.startTimeMs + current.currentCue.responseWindowMs) {
      current = resolveExpired(current)
      continue
    }
    if (!current.currentCue && current.elapsedMs >= current.nextCueAtMs) {
      current = createCue(current)
      continue
    }
    if (step === 0) break
  }
  return current
}

export function advanceReactionArena(
  state: ReactionArenaState,
  frame: ReactionArenaFrame,
): ReactionArenaState {
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  const startTime = state.phase === 'COUNTDOWN'
    ? REACTION_ARENA_RULES.countdownMs - state.countdownRemainingMs
    : state.elapsedMs
  const targetTime = state.phase === 'COUNTDOWN'
    ? startTime + deltaMs
    : state.elapsedMs + deltaMs
  const attempts = [...(frame.actionAttempts ?? [])]
    .filter((attempt) => Number.isFinite(attempt.atMs))
    .sort((a, b) => a.atMs - b.atMs)
  let current = state
  let cursor = startTime
  for (const attempt of attempts) {
    if (current.phase !== 'PLAYING') break
    if (attempt.atMs < cursor) continue
    const attemptAt = Math.max(cursor, Math.min(targetTime, attempt.atMs))
    current = advanceTime(current, attemptAt - cursor)
    cursor = attemptAt
    const kind = normalizeReactionArenaAction(attempt.action)
    if (!kind || !current.currentCue || current.currentCue.state !== 'ACTIVE') continue
    if (attemptAt < current.currentCue.startTimeMs || attemptAt > current.currentCue.startTimeMs + current.currentCue.responseWindowMs) continue
    if (kind === current.currentCue.kind) current = resolveSuccess(current, attemptAt)
  }
  const remaining = Math.max(0, targetTime - cursor)
  current = advanceTime(current, remaining)
  return current
}

export function replayReactionArena(state: ReactionArenaState): ReactionArenaState {
  return createReactionArenaState({ seed: state.initialSeed })
}
