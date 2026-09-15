export const SOUND_CANNON_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  targetWaveStartMs: 15_000,
  powerWaveStartMs: 35_000,
  finalBarrageStartMs: 50_000,
  warmUpSpacingMs: 2_800,
  targetWaveSpacingMs: 2_400,
  powerWaveSpacingMs: 2_100,
  finalBarrageSpacingMs: 1_800,
  minimumTargetSpacingMs: 1_800,
  visualLeadMs: 1_800,
  maximumChargeVoiceMs: 900,
  perfectWindowMs: 130,
  greatWindowMs: 270,
  goodWindowMs: 430,
  orbBonus: 50,
  shieldBonus: 80,
  cometBonus: 100,
  perfectScore: 150,
  greatScore: 120,
  goodScore: 90,
  chargeBonusMax: 80,
  fullBlastBonus: 50,
  fullBlastThreshold: 0.85,
  streakTierSize: 5,
  streakBonusPerTier: 10,
  streakBonusCap: 50,
  maximumSustainedDurationSeconds: 4,
})

export type SoundCannonPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type SoundCannonGameplayPhase = 'WARM_UP' | 'TARGET_WAVE' | 'POWER_WAVE' | 'FINAL_BARRAGE'
export type SoundCannonTargetType = 'ORB' | 'SHIELD' | 'COMET'
export type SoundCannonTargetRegion = 'HIGH' | 'CENTER' | 'LOW'
export type SoundCannonTargetResolution = 'PENDING' | 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
export type SoundCannonContactGrade = Exclude<SoundCannonTargetResolution, 'PENDING' | 'MISS'>
export type SoundCannonFireOutcome = 'HIT' | 'WASTED'

export interface SoundCannonTarget {
  readonly id: number
  readonly type: SoundCannonTargetType
  readonly region: SoundCannonTargetRegion
  readonly targetTimeMs: number
  readonly resolution: SoundCannonTargetResolution
}

export interface SoundCannonFireEvent {
  readonly timestampMs: number
  readonly blastPower: number
  readonly fullBlast: boolean
  readonly sequence?: number
}

export interface SoundCannonHitMetadata {
  readonly targetId: number
  readonly targetType: SoundCannonTargetType
  readonly region: SoundCannonTargetRegion
  readonly grade: SoundCannonContactGrade
  readonly offsetMs: number
  readonly blastPower: number
  readonly blastRadius: number
  readonly fullBlast: boolean
  readonly scoreAwarded: number
}

export interface SoundCannonResult {
  readonly outcome: SoundCannonFireOutcome | 'MISS'
  readonly targetId: number | null
  readonly resolvedAtMs: number
  readonly scoreAwarded: number
  readonly hit: SoundCannonHitMetadata | null
}

export type SoundCannonPresentationEvent =
  | Readonly<{ kind: 'PHASE_START'; phase: SoundCannonGameplayPhase; sequence: number }>
  | Readonly<{ kind: 'HIT'; result: SoundCannonResult; sequence: number }>
  | Readonly<{ kind: 'WASTED_SHOT'; result: SoundCannonResult; sequence: number }>
  | Readonly<{ kind: 'MISS'; result: SoundCannonResult; sequence: number }>
  | Readonly<{ kind: 'FULL_BLAST'; hit: SoundCannonHitMetadata; sequence: number }>
  | Readonly<{ kind: 'FINAL_BARRAGE_START'; sequence: number }>
  | Readonly<{ kind: 'ROUND_FINISH'; sequence: number }>

type SoundCannonPresentationEventInput =
  | Readonly<{ kind: 'PHASE_START'; phase: SoundCannonGameplayPhase }>
  | Readonly<{ kind: 'HIT'; result: SoundCannonResult }>
  | Readonly<{ kind: 'WASTED_SHOT'; result: SoundCannonResult }>
  | Readonly<{ kind: 'MISS'; result: SoundCannonResult }>
  | Readonly<{ kind: 'FULL_BLAST'; hit: SoundCannonHitMetadata }>
  | Readonly<{ kind: 'FINAL_BARRAGE_START' }>
  | Readonly<{ kind: 'ROUND_FINISH' }>

export interface SoundCannonState {
  readonly phase: SoundCannonPhase
  readonly gamePhase: SoundCannonGameplayPhase
  readonly countdownRemainingMs: number
  readonly elapsedMs: number
  readonly roundRemainingMs: number
  readonly targets: readonly SoundCannonTarget[]
  readonly score: number
  readonly shotsFired: number
  readonly hits: number
  readonly misses: number
  readonly wastedShots: number
  readonly perfectCount: number
  readonly greatCount: number
  readonly goodCount: number
  readonly orbHits: number
  readonly shieldHits: number
  readonly cometHits: number
  readonly fullBlastCount: number
  readonly currentStreak: number
  readonly bestStreak: number
  readonly charge: number
  readonly voiceMeterLevel: number
  readonly cannonState: 'ARMED' | 'CHARGING' | 'WAITING_FOR_QUIET'
  readonly lastResult: SoundCannonResult | null
  readonly lastHit: SoundCannonHitMetadata | null
  readonly presentationEvents: readonly SoundCannonPresentationEvent[]
  readonly presentationSequence: number
  readonly lastConsumedFireSequence: number
  readonly randomState: number
  readonly initialSeed: number
  readonly finalResult: SoundCannonFinalResult | null
}

export interface SoundCannonFinalResult {
  readonly score: number
  readonly hits: number
  readonly misses: number
  readonly wastedShots: number
  readonly fullBlastCount: number
  readonly bestStreak: number
  readonly perfectCount: number
}

export interface CreateSoundCannonStateOptions { readonly seed?: number }

export interface SoundCannonFrame {
  readonly deltaMs: number
  readonly fireEvents?: readonly SoundCannonFireEvent[]
  readonly charge?: number
  readonly voiceMeterLevel?: number
  readonly cannonState?: SoundCannonState['cannonState']
}

interface MutableRoundState {
  targets: SoundCannonTarget[]
  score: number
  shotsFired: number
  hits: number
  misses: number
  wastedShots: number
  perfectCount: number
  greatCount: number
  goodCount: number
  orbHits: number
  shieldHits: number
  cometHits: number
  fullBlastCount: number
  currentStreak: number
  bestStreak: number
  lastResult: SoundCannonResult | null
  lastHit: SoundCannonHitMetadata | null
  presentationEvents: SoundCannonPresentationEvent[]
  presentationSequence: number
}

const DEFAULT_SEED = 0x534f554e
const TARGET_TYPES: readonly SoundCannonTargetType[] = ['ORB', 'SHIELD', 'COMET']
const TARGET_REGIONS: readonly SoundCannonTargetRegion[] = ['HIGH', 'CENTER', 'LOW']

function clamp01(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) }
function normalizedSeed(seed: number | undefined): number { return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED }
function nextRandom(randomState: number): readonly [number, number] {
  const nextState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return [nextState / 4_294_967_296, nextState]
}
function phaseForElapsed(elapsedMs: number): SoundCannonGameplayPhase {
  if (elapsedMs >= SOUND_CANNON_RULES.finalBarrageStartMs) return 'FINAL_BARRAGE'
  if (elapsedMs >= SOUND_CANNON_RULES.powerWaveStartMs) return 'POWER_WAVE'
  if (elapsedMs >= SOUND_CANNON_RULES.targetWaveStartMs) return 'TARGET_WAVE'
  return 'WARM_UP'
}

export function soundCannonPhaseAt(elapsedMs: number): SoundCannonGameplayPhase { return phaseForElapsed(Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)) }
export function soundCannonTargetSpacingAt(targetTimeMs: number): number {
  if (targetTimeMs >= SOUND_CANNON_RULES.finalBarrageStartMs) return SOUND_CANNON_RULES.finalBarrageSpacingMs
  if (targetTimeMs >= SOUND_CANNON_RULES.powerWaveStartMs) return SOUND_CANNON_RULES.powerWaveSpacingMs
  if (targetTimeMs >= SOUND_CANNON_RULES.targetWaveStartMs) return SOUND_CANNON_RULES.targetWaveSpacingMs
  return SOUND_CANNON_RULES.warmUpSpacingMs
}
export function soundCannonComfortLevel(voiceLevel: number): number { return Math.sqrt(clamp01(((Number.isFinite(voiceLevel) ? voiceLevel : 0) - 0.1) / 0.4)) }
export function soundCannonDurationFactor(sustainedDurationSeconds: number): number { return clamp01((Number.isFinite(sustainedDurationSeconds) ? sustainedDurationSeconds : 0) / 0.75) }
export function soundCannonPowerFactor(comfortLevel: number): number { return 0.75 + clamp01(comfortLevel) * 0.25 }
export function soundCannonCharge(comfortLevel: number, sustainedDurationSeconds: number): number { return clamp01(soundCannonDurationFactor(sustainedDurationSeconds) * soundCannonPowerFactor(comfortLevel)) }
export function soundCannonStreakBonus(streak: number): number { return Math.min(SOUND_CANNON_RULES.streakBonusCap, Math.floor(Math.max(0, Number.isFinite(streak) ? streak : 0) / SOUND_CANNON_RULES.streakTierSize) * SOUND_CANNON_RULES.streakBonusPerTier) }
export function soundCannonTimingGrade(offsetMs: number): SoundCannonContactGrade | null {
  const offset = Math.abs(Number.isFinite(offsetMs) ? offsetMs : Number.POSITIVE_INFINITY)
  if (offset <= SOUND_CANNON_RULES.perfectWindowMs) return 'PERFECT'
  if (offset <= SOUND_CANNON_RULES.greatWindowMs) return 'GREAT'
  if (offset <= SOUND_CANNON_RULES.goodWindowMs) return 'GOOD'
  return null
}

/** Seeded target data; first four encounters teach the target silhouettes. */
export function generateSoundCannonTargets(seed: number): readonly SoundCannonTarget[] {
  let randomState = normalizedSeed(seed)
  let targetTimeMs = SOUND_CANNON_RULES.visualLeadMs
  const targets: SoundCannonTarget[] = []
  const warmUpTypes: readonly SoundCannonTargetType[] = ['ORB', 'ORB', 'SHIELD', 'COMET']
  let variedIndex = 0
  while (targetTimeMs < SOUND_CANNON_RULES.roundMs) {
    const [typeUnit, afterType] = nextRandom(randomState); randomState = afterType
    const [regionUnit, afterRegion] = nextRandom(randomState); randomState = afterRegion
    const type = targets.length < warmUpTypes.length ? warmUpTypes[targets.length]! : TARGET_TYPES[(variedIndex + Math.floor(typeUnit * TARGET_TYPES.length)) % TARGET_TYPES.length]!
    const region = TARGET_REGIONS[(targets.length + Math.floor(regionUnit * TARGET_REGIONS.length)) % TARGET_REGIONS.length]!
    targets.push(Object.freeze({ id: targets.length + 1, type, region, targetTimeMs, resolution: 'PENDING' as const }))
    if (targets.length >= warmUpTypes.length) variedIndex += 1
    targetTimeMs += soundCannonTargetSpacingAt(targetTimeMs)
  }
  return Object.freeze(targets)
}

function freezeResult(result: SoundCannonResult | null): SoundCannonResult | null { return result ? Object.freeze({ ...result, hit: result.hit ? Object.freeze({ ...result.hit }) : null }) : null }
function freezeState(state: SoundCannonState): SoundCannonState {
  return Object.freeze({ ...state, targets: Object.freeze(state.targets.map((target) => Object.freeze({ ...target }))), lastResult: freezeResult(state.lastResult), lastHit: state.lastHit ? Object.freeze({ ...state.lastHit }) : null, presentationEvents: Object.freeze(state.presentationEvents.map((event) => Object.freeze({ ...event }))), finalResult: state.finalResult ? Object.freeze({ ...state.finalResult }) : null })
}
export function createSoundCannonState(options: CreateSoundCannonStateOptions = {}): SoundCannonState {
  const initialSeed = normalizedSeed(options.seed)
  return freezeState({ phase: 'COUNTDOWN', gamePhase: 'WARM_UP', countdownRemainingMs: SOUND_CANNON_RULES.countdownMs, elapsedMs: 0, roundRemainingMs: SOUND_CANNON_RULES.roundMs, targets: generateSoundCannonTargets(initialSeed), score: 0, shotsFired: 0, hits: 0, misses: 0, wastedShots: 0, perfectCount: 0, greatCount: 0, goodCount: 0, orbHits: 0, shieldHits: 0, cometHits: 0, fullBlastCount: 0, currentStreak: 0, bestStreak: 0, charge: 0, voiceMeterLevel: 0, cannonState: 'ARMED', lastResult: null, lastHit: null, presentationEvents: [], presentationSequence: 0, lastConsumedFireSequence: 0, randomState: 0, initialSeed, finalResult: null })
}
export function replaySoundCannon(state: SoundCannonState): SoundCannonState { return createSoundCannonState({ seed: state.initialSeed }) }

function mutableFrom(state: SoundCannonState): MutableRoundState { return { targets: state.targets.map((target) => ({ ...target })), score: state.score, shotsFired: state.shotsFired, hits: state.hits, misses: state.misses, wastedShots: state.wastedShots, perfectCount: state.perfectCount, greatCount: state.greatCount, goodCount: state.goodCount, orbHits: state.orbHits, shieldHits: state.shieldHits, cometHits: state.cometHits, fullBlastCount: state.fullBlastCount, currentStreak: state.currentStreak, bestStreak: state.bestStreak, lastResult: state.lastResult, lastHit: state.lastHit, presentationEvents: [], presentationSequence: state.presentationSequence } }
function event(round: MutableRoundState, payload: SoundCannonPresentationEventInput): void { round.presentationSequence += 1; round.presentationEvents.push(Object.freeze({ ...payload, sequence: round.presentationSequence }) as SoundCannonPresentationEvent) }
function baseScore(grade: SoundCannonContactGrade): number { return grade === 'PERFECT' ? SOUND_CANNON_RULES.perfectScore : grade === 'GREAT' ? SOUND_CANNON_RULES.greatScore : SOUND_CANNON_RULES.goodScore }
function targetBonus(type: SoundCannonTargetType): number { return type === 'ORB' ? SOUND_CANNON_RULES.orbBonus : type === 'SHIELD' ? SOUND_CANNON_RULES.shieldBonus : SOUND_CANNON_RULES.cometBonus }

function resolveMiss(round: MutableRoundState, index: number, resolvedAtMs: number): void {
  const target = round.targets[index]; if (!target || target.resolution !== 'PENDING') return
  round.targets[index] = { ...target, resolution: 'MISS' }; round.misses += 1; round.currentStreak = 0
  const result = Object.freeze({ outcome: 'MISS' as const, targetId: target.id, resolvedAtMs, scoreAwarded: 0, hit: null })
  round.lastResult = result; event(round, { kind: 'MISS', result })
}
function resolveExpired(round: MutableRoundState, untilMs: number, includeAll = false): void {
  round.targets.forEach((target, index) => { if (target.resolution === 'PENDING' && (includeAll || target.targetTimeMs + SOUND_CANNON_RULES.goodWindowMs < untilMs)) resolveMiss(round, index, includeAll ? untilMs : target.targetTimeMs + SOUND_CANNON_RULES.goodWindowMs) })
}
function nearestTarget(round: MutableRoundState, timestampMs: number): number {
  let selected = -1; let distance = Number.POSITIVE_INFINITY
  round.targets.forEach((target, index) => { if (target.resolution !== 'PENDING') return; const candidate = Math.abs(timestampMs - target.targetTimeMs); if (candidate <= SOUND_CANNON_RULES.goodWindowMs && candidate < distance) { selected = index; distance = candidate } })
  return selected
}
function resolveFire(round: MutableRoundState, fire: SoundCannonFireEvent): void {
  round.shotsFired += 1
  const index = nearestTarget(round, fire.timestampMs)
  if (index < 0) {
    const prior = round.targets.find((target) => target.resolution === 'PENDING')
    if (prior && fire.timestampMs < prior.targetTimeMs - SOUND_CANNON_RULES.goodWindowMs) {
      round.wastedShots += 1; round.currentStreak = 0
      const result = Object.freeze({ outcome: 'WASTED' as const, targetId: null, resolvedAtMs: fire.timestampMs, scoreAwarded: 0, hit: null })
      round.lastResult = result; event(round, { kind: 'WASTED_SHOT', result })
    }
    return
  }
  const target = round.targets[index]!; const offsetMs = fire.timestampMs - target.targetTimeMs; const grade = soundCannonTimingGrade(offsetMs); if (!grade) return
  const blastPower = clamp01(fire.blastPower); const fullBlast = blastPower >= SOUND_CANNON_RULES.fullBlastThreshold
  const blastRadius = 0.6 + blastPower * 0.4; const nextStreak = round.currentStreak + 1; const streakBonus = soundCannonStreakBonus(nextStreak)
  const scoreAwarded = baseScore(grade) + targetBonus(target.type) + Math.round(blastPower * SOUND_CANNON_RULES.chargeBonusMax) + (fullBlast ? SOUND_CANNON_RULES.fullBlastBonus : 0) + streakBonus
  const hit = Object.freeze({ targetId: target.id, targetType: target.type, region: target.region, grade, offsetMs, blastPower, blastRadius, fullBlast, scoreAwarded })
  round.targets[index] = { ...target, resolution: grade }; round.score += scoreAwarded; round.hits += 1; round.currentStreak = nextStreak; round.bestStreak = Math.max(round.bestStreak, nextStreak); if (grade === 'PERFECT') round.perfectCount += 1; else if (grade === 'GREAT') round.greatCount += 1; else round.goodCount += 1; if (target.type === 'ORB') round.orbHits += 1; else if (target.type === 'SHIELD') round.shieldHits += 1; else round.cometHits += 1; if (fullBlast) round.fullBlastCount += 1
  const result = Object.freeze({ outcome: 'HIT' as const, targetId: target.id, resolvedAtMs: fire.timestampMs, scoreAwarded, hit })
  round.lastResult = result; round.lastHit = hit; event(round, { kind: 'HIT', result }); if (fullBlast) event(round, { kind: 'FULL_BLAST', hit })
}
function finish(state: SoundCannonState): SoundCannonState {
  const result = Object.freeze({ score: Math.max(0, state.score), hits: state.hits, misses: state.misses, wastedShots: state.wastedShots, fullBlastCount: state.fullBlastCount, bestStreak: state.bestStreak, perfectCount: state.perfectCount })
  const round = mutableFrom(state); round.presentationEvents = [...state.presentationEvents]; event(round, { kind: 'ROUND_FINISH' }); return freezeState({ ...state, ...round, phase: 'FINISHED', elapsedMs: SOUND_CANNON_RULES.roundMs, roundRemainingMs: 0, finalResult: result })
}

function advancePlaying(state: SoundCannonState, frame: SoundCannonFrame): SoundCannonState {
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0); const elapsedMs = Math.min(SOUND_CANNON_RULES.roundMs, state.elapsedMs + deltaMs); const round = mutableFrom(state)
  const fireEvents = [...(frame.fireEvents ?? [])].filter((fire) => Number.isFinite(fire.timestampMs) && fire.timestampMs <= elapsedMs).sort((a, b) => a.timestampMs - b.timestampMs || (a.sequence ?? 0) - (b.sequence ?? 0))
  for (const fire of fireEvents) { if (fire.sequence !== undefined && fire.sequence <= state.lastConsumedFireSequence) continue; resolveExpired(round, fire.timestampMs); resolveFire(round, fire) }
  resolveExpired(round, elapsedMs, elapsedMs >= SOUND_CANNON_RULES.roundMs)
  const nextPhase = phaseForElapsed(elapsedMs); if (nextPhase !== state.gamePhase) { event(round, { kind: 'PHASE_START', phase: nextPhase }); if (nextPhase === 'FINAL_BARRAGE') event(round, { kind: 'FINAL_BARRAGE_START' }) }
  const maxSequence = fireEvents.reduce((max, fire) => Math.max(max, fire.sequence ?? max), state.lastConsumedFireSequence)
  const next = freezeState({ ...state, ...round, gamePhase: nextPhase, phase: elapsedMs >= SOUND_CANNON_RULES.roundMs ? 'FINISHED' : 'PLAYING', countdownRemainingMs: 0, elapsedMs, roundRemainingMs: Math.max(0, SOUND_CANNON_RULES.roundMs - elapsedMs), charge: clamp01(frame.charge ?? state.charge), voiceMeterLevel: clamp01(frame.voiceMeterLevel ?? state.voiceMeterLevel), cannonState: frame.cannonState ?? state.cannonState, lastConsumedFireSequence: maxSequence })
  return next.phase === 'FINISHED' ? finish(next) : next
}
export function advanceSoundCannon(state: SoundCannonState, frame: SoundCannonFrame): SoundCannonState {
  if (state.phase === 'FINISHED') return state
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  if (state.phase === 'PLAYING') return advancePlaying(state, { ...frame, deltaMs })
  if (deltaMs < state.countdownRemainingMs) return freezeState({ ...state, countdownRemainingMs: state.countdownRemainingMs - deltaMs, presentationEvents: [] })
  const carryMs = deltaMs - state.countdownRemainingMs; const round = mutableFrom(state); event(round, { kind: 'PHASE_START', phase: 'WARM_UP' }); const playing = freezeState({ ...state, ...round, phase: 'PLAYING', countdownRemainingMs: 0 })
  return carryMs > 0 ? advancePlaying(playing, { ...frame, deltaMs: carryMs }) : playing
}
