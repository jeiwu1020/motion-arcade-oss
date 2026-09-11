import type { LogicalPlayfieldRect } from '../../spatial/spatialPlayfieldMapping'

export const BALLOON_RALLY_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  rallyStartMs: 15_000,
  feverStartMs: 35_000,
  partyRushStartMs: 50_000,
  ordinaryMaxHp: 2,
  partyMaxHp: 1,
  visualRadius: 68,
  spawnSeparation: 18,
  initialMinimumSpeed: 70,
  initialMaximumSpeed: 120,
  partyInitialMinimumSpeed: 95,
  partyInitialMaximumSpeed: 155,
  ordinaryMaximumSpeed: 360,
  partyRushMaximumSpeed: 420,
  partyRushSpeedBoost: 1.28,
  maximumImpulse: 260,
  standardPopBonus: 2,
  partyPopBonus: 1,
  comboWindowMs: 1_500,
  comboBonusStartsAt: 5,
  comboHitBonus: 1,
  antiCornerBandPx: 88,
  antiCornerAcceleration: 72,
  partyAntiCornerAcceleration: 90,
})

export type BalloonRallyPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type BalloonHandSide = 'LEFT' | 'RIGHT'
export type BalloonRallyProgression = 'WARM_UP' | 'RALLY' | 'FEVER' | 'PARTY_RUSH'
export type BalloonRallyBalloonKind = 'STANDARD' | 'PARTY'

export interface BalloonRallyBalloon {
  readonly id: number
  readonly kind: BalloonRallyBalloonKind
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly radius: number
  readonly hp: number
  readonly maxHp: number
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

function progressionAt(elapsedMs: number): BalloonRallyProgression {
  if (elapsedMs >= BALLOON_RALLY_RULES.partyRushStartMs) return 'PARTY_RUSH'
  if (elapsedMs >= BALLOON_RALLY_RULES.feverStartMs) return 'FEVER'
  if (elapsedMs >= BALLOON_RALLY_RULES.rallyStartMs) return 'RALLY'
  return 'WARM_UP'
}

function desiredPopulation(progression: BalloonRallyProgression): number {
  switch (progression) {
    case 'PARTY_RUSH':
      return 5
    case 'FEVER':
      return 4
    case 'RALLY':
      return 3
    case 'WARM_UP':
      return 2
  }
}

function hasUsableRegion(region: LogicalPlayfieldRect | null): region is LogicalPlayfieldRect {
  return Boolean(
    region &&
      Number.isFinite(region.x) &&
      Number.isFinite(region.y) &&
      Number.isFinite(region.width) &&
      Number.isFinite(region.height) &&
      region.width >= BALLOON_RALLY_RULES.visualRadius * 2 + 2 &&
      region.height >= BALLOON_RALLY_RULES.visualRadius * 2 + 2,
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

function maximumSpeedFor(balloon: BalloonRallyBalloon): number {
  return balloon.kind === 'PARTY'
    ? BALLOON_RALLY_RULES.partyRushMaximumSpeed
    : BALLOON_RALLY_RULES.ordinaryMaximumSpeed
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
  return {
    ...balloon,
    x: clamp(balloon.x, bounds.left, bounds.right),
    y: clamp(balloon.y, bounds.top, bounds.bottom),
  }
}

function reflect(
  position: number,
  velocity: number,
  minimum: number,
  maximum: number,
  deltaSeconds: number,
): readonly [number, number] {
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

function steerFromOuterBand(
  position: number,
  minimum: number,
  maximum: number,
  deltaSeconds: number,
  acceleration: number,
): number {
  const span = Math.max(0, maximum - minimum)
  const band = Math.min(BALLOON_RALLY_RULES.antiCornerBandPx, span * 0.25)
  if (band === 0) return 0
  if (position < minimum + band) return acceleration * deltaSeconds
  if (position > maximum - band) return -acceleration * deltaSeconds
  return 0
}

function integrateBalloon(
  balloon: BalloonRallyBalloon,
  region: LogicalPlayfieldRect,
  deltaMs: number,
): BalloonRallyBalloon {
  const recovered = placeInside(balloon, region)
  const bounds = interior(region, recovered.radius)
  const deltaSeconds = deltaMs / 1_000
  const steering = recovered.kind === 'PARTY'
    ? BALLOON_RALLY_RULES.partyAntiCornerAcceleration
    : BALLOON_RALLY_RULES.antiCornerAcceleration
  const [vx, vy] = speedLimit(
    recovered.vx + steerFromOuterBand(recovered.x, bounds.left, bounds.right, deltaSeconds, steering),
    recovered.vy + steerFromOuterBand(recovered.y, bounds.top, bounds.bottom, deltaSeconds, steering),
    maximumSpeedFor(recovered),
  )
  const [x, bouncedVx] = reflect(recovered.x, vx, bounds.left, bounds.right, deltaSeconds)
  const [y, bouncedVy] = reflect(recovered.y, vy, bounds.top, bounds.bottom, deltaSeconds)
  return { ...recovered, x, y, vx: bouncedVx, vy: bouncedVy }
}

function candidateOverlaps(
  candidate: BalloonRallyBalloon,
  balloons: readonly BalloonRallyBalloon[],
): boolean {
  return balloons.some((balloon) =>
    Math.hypot(candidate.x - balloon.x, candidate.y - balloon.y) <
    candidate.radius + balloon.radius + BALLOON_RALLY_RULES.spawnSeparation,
  )
}

function spawnBalloon(
  state: BalloonRallyState,
  existing: readonly BalloonRallyBalloon[],
  region: LogicalPlayfieldRect,
): Readonly<{ balloon: BalloonRallyBalloon; randomState: number }> {
  const bounds = interior(region, BALLOON_RALLY_RULES.visualRadius)
  const kind: BalloonRallyBalloonKind = state.partyRush ? 'PARTY' : 'STANDARD'
  const minimumSpeed = kind === 'PARTY'
    ? BALLOON_RALLY_RULES.partyInitialMinimumSpeed
    : BALLOON_RALLY_RULES.initialMinimumSpeed
  const maximumSpeed = kind === 'PARTY'
    ? BALLOON_RALLY_RULES.partyInitialMaximumSpeed
    : BALLOON_RALLY_RULES.initialMaximumSpeed
  const maxHp = kind === 'PARTY'
    ? BALLOON_RALLY_RULES.partyMaxHp
    : BALLOON_RALLY_RULES.ordinaryMaxHp
  let randomState = state.randomState
  let candidate: BalloonRallyBalloon | null = null

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [xUnit, afterX] = nextRandom(randomState)
    const [yUnit, afterY] = nextRandom(afterX)
    const [angleUnit, afterAngle] = nextRandom(afterY)
    const [speedUnit, afterSpeed] = nextRandom(afterAngle)
    randomState = afterSpeed
    const speed = minimumSpeed + (maximumSpeed - minimumSpeed) * speedUnit
    candidate = {
      id: state.nextBalloonId,
      kind,
      x: bounds.left + (bounds.right - bounds.left) * xUnit,
      y: bounds.top + (bounds.bottom - bounds.top) * yUnit,
      vx: Math.cos(angleUnit * Math.PI * 2) * speed,
      vy: Math.sin(angleUnit * Math.PI * 2) * speed,
      radius: BALLOON_RALLY_RULES.visualRadius,
      hp: maxHp,
      maxHp,
    }
    if (!candidateOverlaps(candidate, existing)) break
  }

  return {
    balloon: candidate ?? {
      id: state.nextBalloonId,
      kind,
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
      vx: minimumSpeed,
      vy: 0,
      radius: BALLOON_RALLY_RULES.visualRadius,
      hp: maxHp,
      maxHp,
    },
    randomState,
  }
}

function populate(state: BalloonRallyState, region: LogicalPlayfieldRect): BalloonRallyState {
  let nextState = state
  let balloons = [...state.balloons]
  while (balloons.length < desiredPopulation(state.progression)) {
    const spawned = spawnBalloon(nextState, balloons, region)
    balloons = [...balloons, spawned.balloon]
    nextState = {
      ...nextState,
      balloons,
      nextBalloonId: nextState.nextBalloonId + 1,
      randomState: spawned.randomState,
    }
  }
  return nextState
}

function updateComboForElapsedTime(state: BalloonRallyState, deltaMs: number): BalloonRallyState {
  if (state.comboRemainingMs <= 0) return state
  const comboRemainingMs = Math.max(0, state.comboRemainingMs - deltaMs)
  return comboRemainingMs === 0
    ? { ...state, combo: 0, comboRemainingMs: 0 }
    : { ...state, comboRemainingMs }
}

function scoreHit(state: BalloonRallyState): BalloonRallyState {
  const combo = state.comboRemainingMs > 0 ? state.combo + 1 : 1
  const comboBonus = combo >= BALLOON_RALLY_RULES.comboBonusStartsAt
    ? BALLOON_RALLY_RULES.comboHitBonus
    : 0
  return {
    ...state,
    score: state.score + 1 + comboBonus,
    hits: state.hits + 1,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    comboRemainingMs: BALLOON_RALLY_RULES.comboWindowMs,
  }
}

function applyContact(
  inputState: BalloonRallyState,
  contact: BalloonRallyContact,
  region: LogicalPlayfieldRect,
): BalloonRallyState {
  const target = inputState.balloons.find((balloon) => balloon.id === contact.balloonId)
  if (!target) return inputState

  const [impulseX, impulseY] = speedLimit(
    Number.isFinite(contact.impulse.x) ? contact.impulse.x : 0,
    Number.isFinite(contact.impulse.y) ? contact.impulse.y : 0,
    BALLOON_RALLY_RULES.maximumImpulse,
  )
  const [vx, vy] = speedLimit(
    target.vx + impulseX,
    target.vy + impulseY,
    maximumSpeedFor(target),
  )
  const state = scoreHit(inputState)
  const remainingHp = target.hp - 1
  if (remainingHp > 0) {
    return {
      ...state,
      balloons: state.balloons.map((balloon) =>
        balloon.id === target.id ? { ...balloon, hp: remainingHp, vx, vy } : balloon,
      ),
    }
  }

  const popBonus = target.kind === 'PARTY'
    ? BALLOON_RALLY_RULES.partyPopBonus
    : BALLOON_RALLY_RULES.standardPopBonus
  const stateAfterPop: BalloonRallyState = {
    ...state,
    score: state.score + popBonus,
    pops: state.pops + 1,
    balloons: state.balloons.filter((balloon) => balloon.id !== target.id),
  }
  return populate(stateAfterPop, region)
}

function enterPartyRush(state: BalloonRallyState): BalloonRallyState {
  if (state.partyRush) return state
  return {
    ...state,
    partyRush: true,
    progression: 'PARTY_RUSH',
    balloons: state.balloons.map((balloon) => {
      const [vx, vy] = speedLimit(
        balloon.vx * BALLOON_RALLY_RULES.partyRushSpeedBoost,
        balloon.vy * BALLOON_RALLY_RULES.partyRushSpeedBoost,
        BALLOON_RALLY_RULES.partyRushMaximumSpeed,
      )
      return {
        ...balloon,
        kind: 'PARTY' as const,
        hp: BALLOON_RALLY_RULES.partyMaxHp,
        maxHp: BALLOON_RALLY_RULES.partyMaxHp,
        vx,
        vy,
      }
    }),
  }
}

export function createBalloonRallyState(
  options: CreateBalloonRallyStateOptions = {},
): BalloonRallyState {
  const seed = normalizedSeed(options.seed)
  return freezeState({
    phase: 'COUNTDOWN',
    countdownRemainingMs: BALLOON_RALLY_RULES.countdownMs,
    roundRemainingMs: BALLOON_RALLY_RULES.roundMs,
    elapsedMs: 0,
    progression: 'WARM_UP',
    score: 0,
    hits: 0,
    pops: 0,
    combo: 0,
    bestCombo: 0,
    comboRemainingMs: 0,
    partyRush: false,
    balloons: [],
    nextBalloonId: 1,
    randomState: seed,
    initialSeed: seed,
  })
}

/** Pure deterministic rules for the Camera AR Balloon Rally v2 round. */
export function advanceBalloonRally(
  inputState: BalloonRallyState,
  frame: BalloonRallyFrame,
): BalloonRallyState {
  const deltaMs = Math.max(0, Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0)
  if (inputState.phase === 'FINISHED' || !hasUsableRegion(frame.interactionRegion)) {
    return inputState
  }
  const region = frame.interactionRegion
  let state: BalloonRallyState = {
    ...inputState,
    balloons: inputState.balloons.map((balloon) => placeInside(balloon, region)),
  }

  if (state.phase === 'COUNTDOWN') {
    if (deltaMs < state.countdownRemainingMs) {
      return freezeState({ ...state, countdownRemainingMs: state.countdownRemainingMs - deltaMs })
    }
    state = populate({ ...state, phase: 'PLAYING', countdownRemainingMs: 0 }, region)
    return advanceBalloonRally(state, {
      ...frame,
      deltaMs: deltaMs - inputState.countdownRemainingMs,
    })
  }

  const activeDeltaMs = Math.min(deltaMs, state.roundRemainingMs)
  const elapsedMs = state.elapsedMs + activeDeltaMs
  state = updateComboForElapsedTime({
    ...state,
    elapsedMs,
    roundRemainingMs: state.roundRemainingMs - activeDeltaMs,
    progression: progressionAt(elapsedMs),
  }, activeDeltaMs)
  if (!state.partyRush && state.progression === 'PARTY_RUSH') {
    state = enterPartyRush(state)
  }
  state = populate(state, region)

  for (const contact of frame.contacts) state = applyContact(state, contact, region)
  state = {
    ...state,
    balloons: state.balloons.map((balloon) => integrateBalloon(balloon, region, activeDeltaMs)),
  }
  if (state.roundRemainingMs <= 0) {
    state = { ...state, phase: 'FINISHED', roundRemainingMs: 0 }
  }
  return freezeState(state)
}

export function replayBalloonRally(state: BalloonRallyState): BalloonRallyState {
  return createBalloonRallyState({ seed: state.initialSeed })
}
