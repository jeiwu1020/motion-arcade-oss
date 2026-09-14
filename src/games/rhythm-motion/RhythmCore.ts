export const RHYTHM_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  warmUpEndMs: 15_000,
  grooveEndMs: 35_000,
  energyEndMs: 50_000,
  finalBeatEndMs: 60_000,
  warmUpSpacingMs: 1_000,
  grooveSpacingMs: 900,
  energySpacingMs: 800,
  finalBeatSpacingMs: 750,
  minimumNoteSpacingMs: 750,
  visualLeadMs: 2_000,
  perfectWindowMs: 120,
  greatWindowMs: 230,
  goodWindowMs: 350,
  perfectScore: 150,
  greatScore: 120,
  goodScore: 90,
  comboBonusStep: 5,
  comboBonusPerTier: 10,
  comboBonusCap: 50,
})

export type RhythmPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type RhythmGameplayPhase = 'WARM_UP' | 'GROOVE' | 'ENERGY' | 'FINAL_BEAT'
export type RhythmAction = 'LEFT' | 'RIGHT' | 'REACH_LEFT' | 'REACH_RIGHT'
export type RhythmNoteResolution = 'PENDING' | 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'

export interface RhythmNote {
  readonly id: number
  readonly action: RhythmAction
  readonly targetTimeMs: number
  readonly resolution: RhythmNoteResolution
}

export interface RhythmActionAttempt {
  readonly action: RhythmAction
  readonly sequence?: number
  readonly atMs?: number
}

export interface RhythmNoteResult {
  readonly noteId: number
  readonly action: RhythmAction
  readonly resolution: Exclude<RhythmNoteResolution, 'PENDING'>
  readonly scoreAward: number
  readonly attemptAtMs: number | null
  readonly hitOffsetMs: number | null
}

export type RhythmPresentationEvent =
  | Readonly<{ kind: 'FINAL_BEAT_START'; sequence: number }>
  | Readonly<{ kind: 'COMBO_MILESTONE'; sequence: number; value: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

export interface RhythmState {
  readonly phase: RhythmPhase
  readonly rhythmPhase: RhythmGameplayPhase
  readonly countdownRemainingMs: number
  readonly roundRemainingMs: number
  readonly elapsedMs: number
  readonly notes: readonly RhythmNote[]
  readonly nextNoteIndex: number
  readonly score: number
  readonly successfulNotes: number
  readonly missedNotes: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly currentCombo: number
  readonly bestCombo: number
  readonly earlyHitCount: number
  readonly lateHitCount: number
  readonly hitOffsetsMs: readonly number[]
  readonly totalAbsoluteHitOffsetMs: number
  readonly meanAbsoluteHitOffsetMs: number
  readonly lastResult: RhythmNoteResult | null
  readonly presentationEvents: readonly RhythmPresentationEvent[]
  readonly randomState: number
  readonly initialSeed: number
}

export interface CreateRhythmStateOptions {
  readonly seed?: number
}

export interface RhythmFrame {
  readonly deltaMs: number
  readonly actionAttempts?: readonly RhythmActionAttempt[]
}

const DEFAULT_SEED = 0x726879
const ACTIONS: readonly RhythmAction[] = [
  'LEFT',
  'RIGHT',
  'REACH_LEFT',
  'REACH_RIGHT',
]
const PATTERNS: readonly (readonly RhythmAction[])[] = [
  ['LEFT', 'RIGHT'],
  ['RIGHT', 'LEFT'],
  ['REACH_LEFT', 'REACH_RIGHT'],
  ['REACH_RIGHT', 'REACH_LEFT'],
  ['LEFT', 'REACH_RIGHT'],
  ['RIGHT', 'REACH_LEFT'],
  ['REACH_LEFT', 'LEFT'],
  ['REACH_RIGHT', 'RIGHT'],
  ['LEFT', 'RIGHT', 'REACH_LEFT', 'REACH_RIGHT'],
  ['RIGHT', 'LEFT', 'REACH_RIGHT', 'REACH_LEFT'],
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

export function rhythmPhaseAt(elapsedMs: number): RhythmGameplayPhase {
  if (elapsedMs >= RHYTHM_RULES.energyEndMs) return 'FINAL_BEAT'
  if (elapsedMs >= RHYTHM_RULES.grooveEndMs) return 'ENERGY'
  return elapsedMs >= RHYTHM_RULES.warmUpEndMs ? 'GROOVE' : 'WARM_UP'
}

export function rhythmNoteSpacingAt(targetTimeMs: number): number {
  if (targetTimeMs >= RHYTHM_RULES.energyEndMs) return RHYTHM_RULES.finalBeatSpacingMs
  if (targetTimeMs >= RHYTHM_RULES.grooveEndMs) return RHYTHM_RULES.energySpacingMs
  if (targetTimeMs >= RHYTHM_RULES.warmUpEndMs) return RHYTHM_RULES.grooveSpacingMs
  return RHYTHM_RULES.warmUpSpacingMs
}

function actionSide(action: RhythmAction): 'LEFT' | 'RIGHT' {
  return action === 'LEFT' || action === 'REACH_LEFT' ? 'LEFT' : 'RIGHT'
}

function chooseSafeAction(
  randomState: number,
  candidate: RhythmAction,
  previous: RhythmAction | null,
  sameSideRun: number,
): readonly [RhythmAction, number, number] {
  const previousSide = previous ? actionSide(previous) : null
  const candidateBlocked = candidate === previous ||
    (previousSide !== null && sameSideRun >= 2 && actionSide(candidate) === previousSide)
  if (!candidateBlocked) {
    return [candidate, randomState, previous && actionSide(candidate) === previousSide ? sameSideRun + 1 : 1]
  }

  const available = ACTIONS.filter((action) =>
    action !== previous &&
    (sameSideRun < 2 || previousSide === null || actionSide(action) !== previousSide),
  )
  const [safeAction, nextState] = randomItem(randomState, available.length > 0 ? available : ACTIONS)
  return [safeAction, nextState, previous && actionSide(safeAction) === previousSide ? sameSideRun + 1 : 1]
}

function createNote(id: number, action: RhythmAction, targetTimeMs: number): RhythmNote {
  return Object.freeze({ id, action, targetTimeMs, resolution: 'PENDING' as const })
}

function generateChart(seed: number): readonly [readonly RhythmNote[], number] {
  let randomState = seed
  const notes: RhythmNote[] = []
  const warmUp: readonly RhythmAction[] = ['LEFT', 'RIGHT', 'REACH_LEFT', 'REACH_RIGHT']
  let targetTimeMs = RHYTHM_RULES.visualLeadMs + RHYTHM_RULES.warmUpSpacingMs / 4
  let previous: RhythmAction | null = null
  let sameSideRun = 0

  for (const action of warmUp) {
    notes.push(createNote(notes.length + 1, action, targetTimeMs))
    const priorAction = previous
    previous = action
    sameSideRun = priorAction && actionSide(action) === actionSide(priorAction) ? sameSideRun + 1 : 1
    targetTimeMs += RHYTHM_RULES.warmUpSpacingMs
  }

  while (targetTimeMs < RHYTHM_RULES.roundMs - RHYTHM_RULES.minimumNoteSpacingMs) {
    const [patternIndex, stateAfterPattern] = randomInt(randomState, 0, PATTERNS.length - 1)
    randomState = stateAfterPattern
    const pattern = PATTERNS[patternIndex]!
    for (const candidate of pattern) {
      if (targetTimeMs >= RHYTHM_RULES.roundMs - 100) break
      const [action, stateAfterAction, nextSameSideRun] = chooseSafeAction(
        randomState,
        candidate,
        previous,
        sameSideRun,
      )
      randomState = stateAfterAction
      notes.push(createNote(notes.length + 1, action, targetTimeMs))
      previous = action
      sameSideRun = nextSameSideRun
      targetTimeMs += rhythmNoteSpacingAt(targetTimeMs)
    }
  }

  return [Object.freeze(notes), randomState]
}

function freezeState(state: RhythmState): RhythmState {
  return Object.freeze({
    ...state,
    notes: Object.freeze(state.notes.map((note) => Object.freeze({ ...note }))),
    hitOffsetsMs: Object.freeze([...state.hitOffsetsMs]),
    lastResult: state.lastResult ? Object.freeze({ ...state.lastResult }) : null,
    presentationEvents: Object.freeze(
      state.presentationEvents.map((event) => Object.freeze({ ...event })),
    ),
  })
}

export function createRhythmState(options: CreateRhythmStateOptions = {}): RhythmState {
  const initialSeed = normalizedSeed(options.seed)
  const [notes, randomState] = generateChart(initialSeed)
  return freezeState({
    phase: 'COUNTDOWN',
    rhythmPhase: 'WARM_UP',
    countdownRemainingMs: RHYTHM_RULES.countdownMs,
    roundRemainingMs: RHYTHM_RULES.roundMs,
    elapsedMs: 0,
    notes,
    nextNoteIndex: 0,
    score: 0,
    successfulNotes: 0,
    missedNotes: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    currentCombo: 0,
    bestCombo: 0,
    earlyHitCount: 0,
    lateHitCount: 0,
    hitOffsetsMs: [],
    totalAbsoluteHitOffsetMs: 0,
    meanAbsoluteHitOffsetMs: 0,
    lastResult: null,
    presentationEvents: [],
    randomState,
    initialSeed,
  })
}

function resolutionForOffset(offsetMs: number): Exclude<RhythmNoteResolution, 'PENDING' | 'MISS'> {
  const absoluteOffset = Math.abs(offsetMs)
  if (absoluteOffset <= RHYTHM_RULES.perfectWindowMs) return 'PERFECT'
  if (absoluteOffset <= RHYTHM_RULES.greatWindowMs) return 'GREAT'
  return 'GOOD'
}

function scoreForResolution(
  resolution: Exclude<RhythmNoteResolution, 'PENDING' | 'MISS'>,
): number {
  if (resolution === 'PERFECT') return RHYTHM_RULES.perfectScore
  if (resolution === 'GREAT') return RHYTHM_RULES.greatScore
  return RHYTHM_RULES.goodScore
}

function firstPendingIndex(notes: readonly RhythmNote[]): number {
  const index = notes.findIndex((note) => note.resolution === 'PENDING')
  return index < 0 ? notes.length : index
}

function resolveNote(
  state: RhythmState,
  noteIndex: number,
  resolution: Exclude<RhythmNoteResolution, 'PENDING'>,
  attemptAtMs: number | null,
): RhythmState {
  const target = state.notes[noteIndex]
  if (!target || target.resolution !== 'PENDING') return state
  const hitOffsetMs = attemptAtMs === null ? null : attemptAtMs - target.targetTimeMs
  const successful = resolution !== 'MISS'
  const currentCombo = successful ? state.currentCombo + 1 : 0
  const comboBonus = successful
    ? Math.min(
        RHYTHM_RULES.comboBonusCap,
        Math.floor(currentCombo / RHYTHM_RULES.comboBonusStep) * RHYTHM_RULES.comboBonusPerTier,
      )
    : 0
  const scoreAward = successful ? scoreForResolution(resolution) + comboBonus : 0
  const successfulNotes = state.successfulNotes + (successful ? 1 : 0)
  const totalAbsoluteHitOffsetMs = state.totalAbsoluteHitOffsetMs +
    (successful && hitOffsetMs !== null ? Math.abs(hitOffsetMs) : 0)
  const result: RhythmNoteResult = {
    noteId: target.id,
    action: target.action,
    resolution,
    scoreAward,
    attemptAtMs,
    hitOffsetMs,
  }
  const notes = state.notes.map((note, index) =>
    index === noteIndex ? { ...note, resolution } : note,
  )
  const milestone = successful && currentCombo > 0 && currentCombo % RHYTHM_RULES.comboBonusStep === 0
  const presentationEvents = milestone
    ? [...state.presentationEvents, {
        kind: 'COMBO_MILESTONE' as const,
        sequence: state.presentationEvents.length + 1,
        value: currentCombo,
      }]
    : state.presentationEvents
  return freezeState({
    ...state,
    notes,
    nextNoteIndex: firstPendingIndex(notes),
    score: state.score + scoreAward,
    successfulNotes,
    missedNotes: state.missedNotes + (successful ? 0 : 1),
    perfectCount: state.perfectCount + (resolution === 'PERFECT' ? 1 : 0),
    greatCount: state.greatCount + (resolution === 'GREAT' ? 1 : 0),
    goodCount: state.goodCount + (resolution === 'GOOD' ? 1 : 0),
    currentCombo,
    bestCombo: Math.max(state.bestCombo, currentCombo),
    earlyHitCount: state.earlyHitCount + (successful && hitOffsetMs !== null && hitOffsetMs < 0 ? 1 : 0),
    lateHitCount: state.lateHitCount + (successful && hitOffsetMs !== null && hitOffsetMs > 0 ? 1 : 0),
    hitOffsetsMs: successful && hitOffsetMs !== null
      ? [...state.hitOffsetsMs, hitOffsetMs]
      : state.hitOffsetsMs,
    totalAbsoluteHitOffsetMs,
    meanAbsoluteHitOffsetMs: successfulNotes > 0
      ? Math.round(totalAbsoluteHitOffsetMs / successfulNotes)
      : 0,
    lastResult: result,
    presentationEvents,
  })
}

function findMatchingNote(
  state: RhythmState,
  action: RhythmAction,
  attemptAtMs: number,
): readonly [number, number] | null {
  let best: { readonly index: number; readonly offset: number } | null = null
  for (let index = 0; index < state.notes.length; index += 1) {
    const note = state.notes[index]!
    if (note.resolution !== 'PENDING' || note.action !== action) continue
    const offset = attemptAtMs - note.targetTimeMs
    if (Math.abs(offset) > RHYTHM_RULES.goodWindowMs) continue
    if (!best || Math.abs(offset) < Math.abs(best.offset) ||
      (Math.abs(offset) === Math.abs(best.offset) && note.id < state.notes[best.index]!.id)) {
      best = { index, offset }
    }
  }
  return best ? [best.index, best.offset] : null
}

function applyAttempts(
  state: RhythmState,
  attempts: readonly RhythmActionAttempt[],
): RhythmState {
  let current = state
  for (const attempt of attempts) {
    const attemptAtMs = Math.max(
      0,
      Math.min(RHYTHM_RULES.roundMs, Number.isFinite(attempt.atMs) ? attempt.atMs ?? current.elapsedMs : current.elapsedMs),
    )
    const match = findMatchingNote(current, attempt.action, attemptAtMs)
    if (!match) continue
    current = resolveNote(current, match[0], resolutionForOffset(match[1]), attemptAtMs)
  }
  return current
}

function expireNotesThrough(state: RhythmState, elapsedMs: number): RhythmState {
  let current = state
  for (let index = 0; index < current.notes.length; index += 1) {
    const note = current.notes[index]!
    if (note.resolution === 'PENDING' && elapsedMs > note.targetTimeMs + RHYTHM_RULES.goodWindowMs) {
      current = resolveNote(
        current,
        index,
        'MISS',
        note.targetTimeMs + RHYTHM_RULES.goodWindowMs,
      )
    }
  }
  return current
}

function advanceClock(state: RhythmState, deltaMs: number): RhythmState {
  if (deltaMs <= 0) return state
  const elapsedMs = Math.min(RHYTHM_RULES.roundMs, state.elapsedMs + deltaMs)
  const crossedFinalBeat =
    state.elapsedMs < RHYTHM_RULES.energyEndMs &&
    elapsedMs >= RHYTHM_RULES.energyEndMs
  return {
    ...state,
    elapsedMs,
    roundRemainingMs: Math.max(0, RHYTHM_RULES.roundMs - elapsedMs),
    rhythmPhase: rhythmPhaseAt(elapsedMs),
    presentationEvents: crossedFinalBeat
      ? [...state.presentationEvents, {
          kind: 'FINAL_BEAT_START' as const,
          sequence: state.presentationEvents.length + 1,
        }]
      : state.presentationEvents,
  }
}

function finishRhythm(state: RhythmState): RhythmState {
  let current = state
  for (let index = 0; index < current.notes.length; index += 1) {
    if (current.notes[index]!.resolution === 'PENDING') {
      current = resolveNote(current, index, 'MISS', null)
    }
  }
  return freezeState({
    ...current,
    phase: 'FINISHED',
    elapsedMs: RHYTHM_RULES.roundMs,
    roundRemainingMs: 0,
    presentationEvents: [...current.presentationEvents, {
      kind: 'ROUND_FINISH',
      sequence: current.presentationEvents.length + 1,
    }],
  })
}

function advancePlaying(
  state: RhythmState,
  deltaMs: number,
  attempts: readonly RhythmActionAttempt[],
): RhythmState {
  let current = applyAttempts(state, attempts)
  current = advanceClock(current, deltaMs)
  current = expireNotesThrough(current, current.elapsedMs)
  if (current.elapsedMs >= RHYTHM_RULES.roundMs) return finishRhythm(current)
  return freezeState(current)
}

export function advanceRhythm(state: RhythmState, frame: RhythmFrame): RhythmState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  if (state.phase === 'COUNTDOWN') {
    const countdownStep = Math.min(deltaMs, state.countdownRemainingMs)
    const countdownRemainingMs = state.countdownRemainingMs - countdownStep
    const next: RhythmState = {
      ...state,
      countdownRemainingMs,
      phase: countdownRemainingMs === 0 ? 'PLAYING' : 'COUNTDOWN',
    }
    const playingRemainder = deltaMs - countdownStep
    return playingRemainder > 0
      ? advancePlaying(next, playingRemainder, [])
      : freezeState(next)
  }
  return advancePlaying(state, deltaMs, frame.actionAttempts ?? [])
}

export function replayRhythm(state: RhythmState): RhythmState {
  return createRhythmState({ seed: state.initialSeed })
}
