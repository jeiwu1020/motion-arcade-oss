import type { LogicalPlayfieldRect } from '../../spatial/spatialPlayfieldMapping'

export const BALLOON_RALLY_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  rallyStartMs: 15_000,
  feverStartMs: 35_000,
  partyRushStartMs: 50_000,
  partyRushSecondWaveMs: 55_000,
  partyRushFinalWaveMs: 58_000,
  ordinaryMaxHp: 2,
  partyMaxHp: 1,
  goldenMaxHp: 1,
  giantMaxHp: 4,
  bonusMaxHp: 1,
  visualRadius: 68,
  goldenRadius: 68,
  giantRadius: 112,
  bonusRadius: 62,
  spawnSeparation: 18,
  initialMinimumSpeed: 70,
  initialMaximumSpeed: 120,
  partyInitialMinimumSpeed: 95,
  partyInitialMaximumSpeed: 155,
  goldenInitialMinimumSpeed: 80,
  goldenInitialMaximumSpeed: 125,
  giantInitialMinimumSpeed: 55,
  giantInitialMaximumSpeed: 90,
  bonusInitialMinimumSpeed: 90,
  bonusInitialMaximumSpeed: 140,
  ordinaryMaximumSpeed: 360,
  partyRushMaximumSpeed: 420,
  goldenMaximumSpeed: 300,
  giantMaximumSpeed: 270,
  bonusMaximumSpeed: 340,
  partyRushSpeedBoost: 1.28,
  maximumImpulse: 260,
  standardPopBonus: 2,
  partyPopBonus: 1,
  goldenPopBonus: 4,
  giantPopBonus: 4,
  bonusPopBonus: 1,
  goldenLifetimeMs: 3_500,
  goldenFirstMinimumMs: 8_000,
  goldenFirstMaximumMs: 12_000,
  goldenIntervalMinimumMs: 8_000,
  goldenIntervalMaximumMs: 12_000,
  giantSpawnMs: 40_000,
  miniEventMinimumStartMs: 27_000,
  miniEventMaximumStartMs: 33_000,
  miniEventDurationMs: 6_000,
  goldRushMaximumConcurrent: 2,
  goldRushSpawnCap: 4,
  balloonRainMaximumConcurrent: 2,
  balloonRainSpawnCap: 6,
  scoreFeverHitBonus: 1,
  comboWindowMs: 1_500,
  partyComboWindowMs: 2_000,
  comboBonusStartsAt: 5,
  comboHitBonus: 1,
  antiCornerBandPx: 88,
  antiCornerAcceleration: 72,
  partyAntiCornerAcceleration: 90,
})

export type BalloonRallyPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type BalloonHandSide = 'LEFT' | 'RIGHT'
export type BalloonRallyProgression = 'WARM_UP' | 'RALLY' | 'FEVER' | 'PARTY_RUSH'
export type BalloonRallyBalloonKind = 'STANDARD' | 'PARTY' | 'GOLDEN' | 'GIANT' | 'BONUS'
export type BalloonRallyMiniEventKind = 'GOLD_RUSH' | 'BALLOON_RAIN' | 'SCORE_FEVER'
export type BalloonRallyMovementPersonality = 'FLOAT' | 'DRIFT' | 'BOUNCE'

export interface BalloonRallyBalloon {
  readonly id: number
  readonly kind: BalloonRallyBalloonKind
  readonly personality: BalloonRallyMovementPersonality
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly radius: number
  readonly hp: number
  readonly maxHp: number
  readonly ageMs: number
}

export interface BalloonRallyContact {
  readonly balloonId: number
  readonly side: BalloonHandSide
  readonly impulse: Readonly<{ x: number; y: number }>
}

export interface BalloonRallyFrame {
  readonly deltaMs: number
  readonly interactionRegion: LogicalPlayfieldRect | null
  readonly contacts: readonly BalloonRallyContact[]
}

export interface BalloonRallyState {
  readonly phase: BalloonRallyPhase
  readonly countdownRemainingMs: number
  readonly roundRemainingMs: number
  readonly elapsedMs: number
  readonly progression: BalloonRallyProgression
  readonly score: number
  readonly hits: number
  readonly pops: number
  readonly combo: number
  readonly bestCombo: number
  readonly comboRemainingMs: number
  readonly partyRush: boolean
  readonly balloons: readonly BalloonRallyBalloon[]
  readonly nextBalloonId: number
  readonly randomState: number
  readonly initialSeed: number
  readonly goldenNextSpawnMs: number
  readonly giantSpawned: boolean
  readonly miniEventKind: BalloonRallyMiniEventKind
  readonly miniEventStartMs: number
  readonly miniEventStarted: boolean
  readonly miniEventCompleted: boolean
  readonly miniEventRemainingMs: number
  readonly miniEventSpawnedCount: number
  readonly miniEventSequence: number
}

export interface CreateBalloonRallyStateOptions {
  readonly seed?: number
}

const DEFAULT_SEED = 0x2a1b00b5

function freezeBalloon(balloon: BalloonRallyBalloon): BalloonRallyBalloon {
  return Object.freeze({ ...balloon })
}

function freezeState(state: BalloonRallyState): BalloonRallyState {
  return Object.freeze({
    ...state,
    balloons: Object.freeze(state.balloons.map(freezeBalloon)),
  })
}

function normalizedSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? Math.trunc(seed ?? DEFAULT_SEED) >>> 0 : DEFAULT_SEED
}

function nextRandom(randomState: number): readonly [number, number] {
  const nextState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return [nextState / 4_294_967_296, nextState]
}

function randomBetween(randomState: number, minimum: number, maximum: number): readonly [number, number] {
  const [unit, nextState] = nextRandom(randomState)
  return [minimum + (maximum - minimum) * unit, nextState]
}

function progressionAt(elapsedMs: number): BalloonRallyProgression {
  if (elapsedMs >= BALLOON_RALLY_RULES.partyRushStartMs) return 'PARTY_RUSH'
  if (elapsedMs >= BALLOON_RALLY_RULES.feverStartMs) return 'FEVER'
  if (elapsedMs >= BALLOON_RALLY_RULES.rallyStartMs) return 'RALLY'
  return 'WARM_UP'
}

function desiredStandardPopulation(progression: BalloonRallyProgression): number {
  switch (progression) {
    case 'PARTY_RUSH': return 5
    case 'FEVER': return 4
    case 'RALLY': return 3
    case 'WARM_UP': return 2
  }
}

function desiredPartyPopulation(elapsedMs: number): number {
  if (elapsedMs >= BALLOON_RALLY_RULES.partyRushFinalWaveMs) return 7
  if (elapsedMs >= BALLOON_RALLY_RULES.partyRushSecondWaveMs) return 6
  return 5
}

function hasUsableRegion(region: LogicalPlayfieldRect | null): region is LogicalPlayfieldRect {
  return Boolean(
    region &&
      Number.isFinite(region.x) &&
      Number.isFinite(region.y) &&
      Number.isFinite(region.width) &&
      Number.isFinite(region.height) &&
      region.width >= BALLOON_RALLY_RULES.giantRadius * 2 + 2 &&
      region.height >= BALLOON_RALLY_RULES.giantRadius * 2 + 2,
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function speedLimit(vx: number, vy: number, maximumSpeed: number): readonly [number, number] {
  const speed = Math.hypot(vx, vy)
  if (speed <= maximumSpeed || speed === 0) return [vx, vy]
  const multiplier = maximumSpeed / speed
  return [vx * multiplier, vy * multiplier]
}

function radiusFor(kind: BalloonRallyBalloonKind): number {
  if (kind === 'GIANT') return BALLOON_RALLY_RULES.giantRadius
  if (kind === 'BONUS') return BALLOON_RALLY_RULES.bonusRadius
  return BALLOON_RALLY_RULES.visualRadius
}

function maximumSpeedFor(balloon: BalloonRallyBalloon): number {
  if (balloon.kind === 'PARTY') return BALLOON_RALLY_RULES.partyRushMaximumSpeed
  if (balloon.kind === 'GOLDEN') return BALLOON_RALLY_RULES.goldenMaximumSpeed
  if (balloon.kind === 'GIANT') return BALLOON_RALLY_RULES.giantMaximumSpeed
  if (balloon.kind === 'BONUS') return BALLOON_RALLY_RULES.bonusMaximumSpeed
  return BALLOON_RALLY_RULES.ordinaryMaximumSpeed
}

function maxHpFor(kind: BalloonRallyBalloonKind): number {
  if (kind === 'PARTY') return BALLOON_RALLY_RULES.partyMaxHp
  if (kind === 'GOLDEN') return BALLOON_RALLY_RULES.goldenMaxHp
  if (kind === 'GIANT') return BALLOON_RALLY_RULES.giantMaxHp
  if (kind === 'BONUS') return BALLOON_RALLY_RULES.bonusMaxHp
  return BALLOON_RALLY_RULES.ordinaryMaxHp
}

function interior(region: LogicalPlayfieldRect, radius: number): Readonly<{
  left: number
  right: number
  top: number
  bottom: number
}> {
  return {
    left: region.x + radius,
    right: region.x + region.width - radius,
    top: region.y + radius,
    bottom: region.y + region.height - radius,
  }
}

function placeInside(balloon: BalloonRallyBalloon, region: LogicalPlayfieldRect): BalloonRallyBalloon {
  const bounds = interior(region, balloon.radius)
  return { ...balloon, x: clamp(balloon.x, bounds.left, bounds.right), y: clamp(balloon.y, bounds.top, bounds.bottom) }
}

function reflect(position: number, velocity: number, minimum: number, maximum: number, deltaSeconds: number): readonly [number, number] {
  let nextPosition = position + velocity * deltaSeconds
  let nextVelocity = velocity
  for (let reflections = 0; reflections < 32; reflections += 1) {
    if (nextPosition < minimum) {
      nextPosition = minimum + (minimum - nextPosition)
      nextVelocity = Math.abs(nextVelocity)
      continue
    }
    if (nextPosition > maximum) {
      nextPosition = maximum - (nextPosition - maximum)
      nextVelocity = -Math.abs(nextVelocity)
      continue
    }
    break
  }
  return [clamp(nextPosition, minimum, maximum), nextVelocity]
}

function steerFromOuterBand(position: number, minimum: number, maximum: number, deltaSeconds: number, acceleration: number): number {
  const span = Math.max(0, maximum - minimum)
  const band = Math.min(BALLOON_RALLY_RULES.antiCornerBandPx, span * 0.25)
  if (band === 0) return 0
  if (position < minimum + band) return acceleration * deltaSeconds
  if (position > maximum - band) return -acceleration * deltaSeconds
  return 0
}

function integrateBalloon(balloon: BalloonRallyBalloon, region: LogicalPlayfieldRect, deltaMs: number): BalloonRallyBalloon {
  const recovered = placeInside(balloon, region)
  const bounds = interior(region, recovered.radius)
  const deltaSeconds = deltaMs / 1_000
  const steering = recovered.kind === 'PARTY' ? BALLOON_RALLY_RULES.partyAntiCornerAcceleration : BALLOON_RALLY_RULES.antiCornerAcceleration
  const [vx, vy] = speedLimit(
    recovered.vx + steerFromOuterBand(recovered.x, bounds.left, bounds.right, deltaSeconds, steering),
    recovered.vy + steerFromOuterBand(recovered.y, bounds.top, bounds.bottom, deltaSeconds, steering),
    maximumSpeedFor(recovered),
  )
  const [x, bouncedVx] = reflect(recovered.x, vx, bounds.left, bounds.right, deltaSeconds)
  const [y, bouncedVy] = reflect(recovered.y, vy, bounds.top, bounds.bottom, deltaSeconds)
  return { ...recovered, x, y, vx: bouncedVx, vy: bouncedVy }
}

function candidateOverlaps(candidate: BalloonRallyBalloon, balloons: readonly BalloonRallyBalloon[]): boolean {
  return balloons.some((balloon) => Math.hypot(candidate.x - balloon.x, candidate.y - balloon.y) < candidate.radius + balloon.radius + BALLOON_RALLY_RULES.spawnSeparation)
}

function personalityForUnit(unit: number): BalloonRallyMovementPersonality {
  if (unit < 1 / 3) return 'FLOAT'
  if (unit < 2 / 3) return 'DRIFT'
  return 'BOUNCE'
}

function speedRangeFor(kind: BalloonRallyBalloonKind, personality: BalloonRallyMovementPersonality): Readonly<{ minimum: number; maximum: number }> {
  if (kind === 'PARTY') return { minimum: BALLOON_RALLY_RULES.partyInitialMinimumSpeed, maximum: BALLOON_RALLY_RULES.partyInitialMaximumSpeed }
  if (kind === 'GOLDEN') return { minimum: BALLOON_RALLY_RULES.goldenInitialMinimumSpeed, maximum: BALLOON_RALLY_RULES.goldenInitialMaximumSpeed }
  if (kind === 'GIANT') return { minimum: BALLOON_RALLY_RULES.giantInitialMinimumSpeed, maximum: BALLOON_RALLY_RULES.giantInitialMaximumSpeed }
  if (kind === 'BONUS') return { minimum: BALLOON_RALLY_RULES.bonusInitialMinimumSpeed, maximum: BALLOON_RALLY_RULES.bonusInitialMaximumSpeed }
  if (personality === 'FLOAT') return { minimum: 70, maximum: 95 }
  if (personality === 'DRIFT') return { minimum: 80, maximum: 112 }
  return { minimum: BALLOON_RALLY_RULES.initialMinimumSpeed, maximum: BALLOON_RALLY_RULES.initialMaximumSpeed }
}

function initialVelocity(kind: BalloonRallyBalloonKind, personality: BalloonRallyMovementPersonality, angleUnit: number, speedUnit: number): Readonly<{ vx: number; vy: number }> {
  const range = speedRangeFor(kind, personality)
  const speed = range.minimum + (range.maximum - range.minimum) * speedUnit
  if (personality === 'DRIFT') {
    const direction = angleUnit < 0.5 ? -1 : 1
    const vertical = (speedUnit - 0.5) * speed * 0.55
    return { vx: direction * Math.sqrt(Math.max(0, speed * speed - vertical * vertical)), vy: vertical }
  }
  const angle = angleUnit * Math.PI * 2
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
}

function spawnBalloon(state: BalloonRallyState, existing: readonly BalloonRallyBalloon[], region: LogicalPlayfieldRect, kind: BalloonRallyBalloonKind): Readonly<{ balloon: BalloonRallyBalloon; randomState: number }> {
  const radius = radiusFor(kind)
  const bounds = interior(region, radius)
  let randomState = state.randomState
  let candidate: BalloonRallyBalloon | null = null
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const [xUnit, afterX] = nextRandom(randomState)
    const [yUnit, afterY] = nextRandom(afterX)
    const [angleUnit, afterAngle] = nextRandom(afterY)
    const [speedUnit, afterSpeed] = nextRandom(afterAngle)
    const [personalityUnit, afterPersonality] = nextRandom(afterSpeed)
    randomState = afterPersonality
    const personality = kind === 'STANDARD' ? personalityForUnit(personalityUnit) : kind === 'BONUS' ? 'BOUNCE' : 'FLOAT'
    const velocity = initialVelocity(kind, personality, angleUnit, speedUnit)
    candidate = {
      id: state.nextBalloonId,
      kind,
      personality,
      x: bounds.left + (bounds.right - bounds.left) * xUnit,
      y: bounds.top + (bounds.bottom - bounds.top) * yUnit,
      vx: velocity.vx,
      vy: velocity.vy,
      radius,
      hp: maxHpFor(kind),
      maxHp: maxHpFor(kind),
      ageMs: 0,
    }
    if (!candidateOverlaps(candidate, existing)) break
  }
  return {
    balloon: candidate ?? {
      id: state.nextBalloonId,
      kind,
      personality: kind === 'STANDARD' ? 'FLOAT' : 'FLOAT',
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
      vx: speedRangeFor(kind, 'FLOAT').minimum,
      vy: 0,
      radius,
      hp: maxHpFor(kind),
      maxHp: maxHpFor(kind),
      ageMs: 0,
    },
    randomState,
  }
}

function countKind(state: BalloonRallyState, kind: BalloonRallyBalloonKind): number {
  return state.balloons.filter((balloon) => balloon.kind === kind).length
}

function spawnOne(state: BalloonRallyState, region: LogicalPlayfieldRect, kind: BalloonRallyBalloonKind): BalloonRallyState {
  const spawned = spawnBalloon(state, state.balloons, region, kind)
  return { ...state, balloons: [...state.balloons, spawned.balloon], nextBalloonId: state.nextBalloonId + 1, randomState: spawned.randomState }
}

function populateStandard(state: BalloonRallyState, region: LogicalPlayfieldRect): BalloonRallyState {
  let nextState = state
  while (countKind(nextState, 'STANDARD') < desiredStandardPopulation(state.progression)) nextState = spawnOne(nextState, region, 'STANDARD')
  return nextState
}

function populateParty(state: BalloonRallyState, region: LogicalPlayfieldRect): BalloonRallyState {
  let nextState = state
  while (countKind(nextState, 'PARTY') < desiredPartyPopulation(nextState.elapsedMs)) nextState = spawnOne(nextState, region, 'PARTY')
  return nextState
}

function scheduleNextGolden(state: BalloonRallyState, fromMs: number): BalloonRallyState {
  const [interval, randomState] = randomBetween(state.randomState, BALLOON_RALLY_RULES.goldenIntervalMinimumMs, BALLOON_RALLY_RULES.goldenIntervalMaximumMs)
  return { ...state, goldenNextSpawnMs: fromMs + Math.round(interval), randomState }
}

function synchronizeMiniEvent(state: BalloonRallyState, region: LogicalPlayfieldRect): BalloonRallyState {
  if (state.partyRush || state.elapsedMs < state.miniEventStartMs) return state
  const remaining = Math.max(0, BALLOON_RALLY_RULES.miniEventDurationMs - (state.elapsedMs - state.miniEventStartMs))
  let nextState = state
  if (!nextState.miniEventStarted) nextState = { ...nextState, miniEventStarted: true, miniEventSequence: nextState.miniEventSequence + 1 }
  nextState = { ...nextState, miniEventRemainingMs: remaining }
  if (remaining <= 0) {
    const removeKind = nextState.miniEventKind === 'BALLOON_RAIN'
      ? 'BONUS'
      : nextState.miniEventKind === 'GOLD_RUSH'
        ? 'GOLDEN'
        : null
    nextState = {
      ...nextState,
      miniEventCompleted: true,
      balloons: removeKind
        ? nextState.balloons.filter((balloon) => balloon.kind !== removeKind)
        : nextState.balloons,
    }
    return nextState.goldenNextSpawnMs <= nextState.elapsedMs ? scheduleNextGolden(nextState, nextState.elapsedMs) : nextState
  }
  if (nextState.miniEventKind === 'GOLD_RUSH') {
    while (countKind(nextState, 'GOLDEN') < BALLOON_RALLY_RULES.goldRushMaximumConcurrent && nextState.miniEventSpawnedCount < BALLOON_RALLY_RULES.goldRushSpawnCap) {
      nextState = { ...spawnOne(nextState, region, 'GOLDEN'), miniEventSpawnedCount: nextState.miniEventSpawnedCount + 1 }
    }
  } else if (nextState.miniEventKind === 'BALLOON_RAIN') {
    while (countKind(nextState, 'BONUS') < BALLOON_RALLY_RULES.balloonRainMaximumConcurrent && nextState.miniEventSpawnedCount < BALLOON_RALLY_RULES.balloonRainSpawnCap) {
      nextState = { ...spawnOne(nextState, region, 'BONUS'), miniEventSpawnedCount: nextState.miniEventSpawnedCount + 1 }
    }
  }
  return nextState
}

function ensureSpecialTargets(state: BalloonRallyState, region: LogicalPlayfieldRect): BalloonRallyState {
  if (state.partyRush) return state
  let nextState = state
  if (nextState.elapsedMs >= BALLOON_RALLY_RULES.giantSpawnMs && !nextState.giantSpawned && nextState.elapsedMs < BALLOON_RALLY_RULES.partyRushStartMs) {
    nextState = { ...spawnOne(nextState, region, 'GIANT'), giantSpawned: true }
  }
  const goldenWindowOpen = (!nextState.miniEventStarted && nextState.elapsedMs < nextState.miniEventStartMs) || nextState.miniEventCompleted
  if (goldenWindowOpen && nextState.elapsedMs >= nextState.goldenNextSpawnMs && nextState.elapsedMs < BALLOON_RALLY_RULES.partyRushStartMs && countKind(nextState, 'GOLDEN') === 0) {
    nextState = scheduleNextGolden(spawnOne(nextState, region, 'GOLDEN'), nextState.elapsedMs)
  }
  return nextState
}

function expireShortLivedTargets(state: BalloonRallyState): BalloonRallyState {
  return { ...state, balloons: state.balloons.filter((balloon) => balloon.kind !== 'GOLDEN' || balloon.ageMs < BALLOON_RALLY_RULES.goldenLifetimeMs) }
}

function updateComboForElapsedTime(state: BalloonRallyState, deltaMs: number): BalloonRallyState {
  if (state.comboRemainingMs <= 0) return state
  const comboRemainingMs = Math.max(0, state.comboRemainingMs - deltaMs)
  return comboRemainingMs === 0 ? { ...state, combo: 0, comboRemainingMs: 0 } : { ...state, comboRemainingMs }
}

function scoreHit(state: BalloonRallyState): BalloonRallyState {
  const combo = state.comboRemainingMs > 0 ? state.combo + 1 : 1
  const comboBonus = combo >= BALLOON_RALLY_RULES.comboBonusStartsAt ? BALLOON_RALLY_RULES.comboHitBonus : 0
  const eventBonus = state.miniEventKind === 'SCORE_FEVER' && state.miniEventRemainingMs > 0 ? BALLOON_RALLY_RULES.scoreFeverHitBonus : 0
  const comboWindowMs = state.partyRush ? BALLOON_RALLY_RULES.partyComboWindowMs : BALLOON_RALLY_RULES.comboWindowMs
  return { ...state, score: state.score + 1 + comboBonus + eventBonus, hits: state.hits + 1, combo, bestCombo: Math.max(state.bestCombo, combo), comboRemainingMs: comboWindowMs }
}

function popBonusFor(kind: BalloonRallyBalloonKind): number {
  if (kind === 'PARTY') return BALLOON_RALLY_RULES.partyPopBonus
  if (kind === 'GOLDEN') return BALLOON_RALLY_RULES.goldenPopBonus
  if (kind === 'GIANT') return BALLOON_RALLY_RULES.giantPopBonus
  if (kind === 'BONUS') return BALLOON_RALLY_RULES.bonusPopBonus
  return BALLOON_RALLY_RULES.standardPopBonus
}

function applyContact(inputState: BalloonRallyState, contact: BalloonRallyContact, region: LogicalPlayfieldRect): BalloonRallyState {
  const target = inputState.balloons.find((balloon) => balloon.id === contact.balloonId)
  if (!target) return inputState
  const [impulseX, impulseY] = speedLimit(Number.isFinite(contact.impulse.x) ? contact.impulse.x : 0, Number.isFinite(contact.impulse.y) ? contact.impulse.y : 0, BALLOON_RALLY_RULES.maximumImpulse)
  const [vx, vy] = speedLimit(target.vx + impulseX, target.vy + impulseY, maximumSpeedFor(target))
  const state = scoreHit(inputState)
  const remainingHp = target.hp - 1
  if (remainingHp > 0) return { ...state, balloons: state.balloons.map((balloon) => balloon.id === target.id ? { ...balloon, hp: remainingHp, vx, vy } : balloon) }
  const stateAfterPop: BalloonRallyState = { ...state, score: state.score + popBonusFor(target.kind), pops: state.pops + 1, balloons: state.balloons.filter((balloon) => balloon.id !== target.id) }
  const repopulated = stateAfterPop.partyRush ? populateParty(stateAfterPop, region) : populateStandard(stateAfterPop, region)
  return synchronizeMiniEvent(ensureSpecialTargets(repopulated, region), region)
}

function enterPartyRush(state: BalloonRallyState): BalloonRallyState {
  if (state.partyRush) return state
  const converted = state.balloons.filter((balloon) => balloon.kind === 'STANDARD').map((balloon) => {
    const [vx, vy] = speedLimit(balloon.vx * BALLOON_RALLY_RULES.partyRushSpeedBoost, balloon.vy * BALLOON_RALLY_RULES.partyRushSpeedBoost, BALLOON_RALLY_RULES.partyRushMaximumSpeed)
    return { ...balloon, kind: 'PARTY' as const, hp: BALLOON_RALLY_RULES.partyMaxHp, maxHp: BALLOON_RALLY_RULES.partyMaxHp, vx, vy, ageMs: 0 }
  })
  return { ...state, partyRush: true, progression: 'PARTY_RUSH', balloons: converted, goldenNextSpawnMs: Number.POSITIVE_INFINITY, miniEventRemainingMs: 0, miniEventCompleted: true }
}

export function createBalloonRallyState(options: CreateBalloonRallyStateOptions = {}): BalloonRallyState {
  const seed = normalizedSeed(options.seed)
  let randomState = seed
  const [goldenDelay, afterGolden] = randomBetween(randomState, BALLOON_RALLY_RULES.goldenFirstMinimumMs, BALLOON_RALLY_RULES.goldenFirstMaximumMs)
  randomState = afterGolden
  const [eventStart, afterEventStart] = randomBetween(randomState, BALLOON_RALLY_RULES.miniEventMinimumStartMs, BALLOON_RALLY_RULES.miniEventMaximumStartMs)
  randomState = afterEventStart
  const [eventUnit, afterEventKind] = nextRandom(randomState)
  randomState = afterEventKind
  const miniEventKind: BalloonRallyMiniEventKind = eventUnit < 1 / 3 ? 'GOLD_RUSH' : eventUnit < 2 / 3 ? 'BALLOON_RAIN' : 'SCORE_FEVER'
  return freezeState({
    phase: 'COUNTDOWN', countdownRemainingMs: BALLOON_RALLY_RULES.countdownMs, roundRemainingMs: BALLOON_RALLY_RULES.roundMs, elapsedMs: 0, progression: 'WARM_UP', score: 0, hits: 0, pops: 0, combo: 0, bestCombo: 0, comboRemainingMs: 0, partyRush: false, balloons: [], nextBalloonId: 1, randomState, initialSeed: seed, goldenNextSpawnMs: Math.round(goldenDelay), giantSpawned: false, miniEventKind, miniEventStartMs: Math.round(eventStart), miniEventStarted: false, miniEventCompleted: false, miniEventRemainingMs: 0, miniEventSpawnedCount: 0, miniEventSequence: 0,
  })
}

/** Pure deterministic rules for the Camera AR Balloon Rally v3 round. */
export function advanceBalloonRally(inputState: BalloonRallyState, frame: BalloonRallyFrame): BalloonRallyState {
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  if (inputState.phase === 'FINISHED' || !hasUsableRegion(frame.interactionRegion)) return inputState
  const region = frame.interactionRegion
  let state: BalloonRallyState = { ...inputState, balloons: inputState.balloons.map((balloon) => placeInside(balloon, region)) }
  if (state.phase === 'COUNTDOWN') {
    if (deltaMs < state.countdownRemainingMs) return freezeState({ ...state, countdownRemainingMs: state.countdownRemainingMs - deltaMs })
    state = populateStandard({ ...state, phase: 'PLAYING', countdownRemainingMs: 0 }, region)
    return advanceBalloonRally(state, { ...frame, deltaMs: deltaMs - inputState.countdownRemainingMs })
  }
  const activeDeltaMs = Math.min(deltaMs, state.roundRemainingMs)
  const elapsedMs = state.elapsedMs + activeDeltaMs
  state = updateComboForElapsedTime({ ...state, elapsedMs, roundRemainingMs: state.roundRemainingMs - activeDeltaMs, progression: progressionAt(elapsedMs), balloons: state.balloons.map((balloon) => ({ ...balloon, ageMs: balloon.ageMs + activeDeltaMs })) }, activeDeltaMs)
  if (!state.partyRush && state.progression === 'PARTY_RUSH') {
    state = enterPartyRush(state)
    state = populateParty(state, region)
  } else if (state.partyRush) {
    state = populateParty(state, region)
  } else if (!state.partyRush) {
    state = synchronizeMiniEvent(state, region)
    state = expireShortLivedTargets(state)
    state = populateStandard(state, region)
    state = ensureSpecialTargets(state, region)
  }
  for (const contact of frame.contacts) state = applyContact(state, contact, region)
  state = { ...state, balloons: state.balloons.map((balloon) => integrateBalloon(balloon, region, activeDeltaMs)) }
  if (state.roundRemainingMs <= 0) state = { ...state, phase: 'FINISHED', roundRemainingMs: 0 }
  return freezeState(state)
}

export function replayBalloonRally(state: BalloonRallyState): BalloonRallyState {
  return createBalloonRallyState({ seed: state.initialSeed })
}
