import type { LogicalPlayfieldRect } from '../../spatial/spatialPlayfieldMapping'

export const BALLOON_RALLY_RULES = Object.freeze({
  countdownMs: 3_000,
  roundMs: 60_000,
  partyRushStartMs: 50_000,
  ordinaryMaxHp: 3,
  visualRadius: 68,
  spawnSeparation: 18,
  initialMinimumSpeed: 70,
  initialMaximumSpeed: 120,
  ordinaryMaximumSpeed: 360,
  partyRushMaximumSpeed: 420,
  partyRushSpeedBoost: 1.22,
  maximumImpulse: 260,
})

export type BalloonRallyPhase = 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
export type BalloonHandSide = 'LEFT' | 'RIGHT'

export interface BalloonRallyBalloon {
  readonly id: number
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
  readonly score: number
  readonly hits: number
  readonly pops: number
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

function desiredPopulation(elapsedMs: number): number {
  if (elapsedMs >= 40_000) return 4
  if (elapsedMs >= 20_000) return 3
  return 2
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

function placeInside(
  balloon: BalloonRallyBalloon,
  region: LogicalPlayfieldRect,
): BalloonRallyBalloon {
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

function integrateBalloon(
  balloon: BalloonRallyBalloon,
  region: LogicalPlayfieldRect,
  deltaMs: number,
  partyRush: boolean,
): BalloonRallyBalloon {
  const recovered = placeInside(balloon, region)
  const maxSpeed = partyRush
    ? BALLOON_RALLY_RULES.partyRushMaximumSpeed
    : BALLOON_RALLY_RULES.ordinaryMaximumSpeed
  const [vx, vy] = speedLimit(recovered.vx, recovered.vy, maxSpeed)
  const bounds = interior(region, recovered.radius)
  const [x, bouncedVx] = reflect(recovered.x, vx, bounds.left, bounds.right, deltaMs / 1_000)
  const [y, bouncedVy] = reflect(recovered.y, vy, bounds.top, bounds.bottom, deltaMs / 1_000)
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
  let randomState = state.randomState
  let candidate: BalloonRallyBalloon | null = null

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [xUnit, afterX] = nextRandom(randomState)
    const [yUnit, afterY] = nextRandom(afterX)
    const [angleUnit, afterAngle] = nextRandom(afterY)
    const [speedUnit, afterSpeed] = nextRandom(afterAngle)
    randomState = afterSpeed
    const speed =
      BALLOON_RALLY_RULES.initialMinimumSpeed +
      (BALLOON_RALLY_RULES.initialMaximumSpeed - BALLOON_RALLY_RULES.initialMinimumSpeed) * speedUnit
    candidate = {
      id: state.nextBalloonId,
      x: bounds.left + (bounds.right - bounds.left) * xUnit,
      y: bounds.top + (bounds.bottom - bounds.top) * yUnit,
      vx: Math.cos(angleUnit * Math.PI * 2) * speed,
      vy: Math.sin(angleUnit * Math.PI * 2) * speed,
      radius: BALLOON_RALLY_RULES.visualRadius,
      hp: BALLOON_RALLY_RULES.ordinaryMaxHp,
      maxHp: BALLOON_RALLY_RULES.ordinaryMaxHp,
    }
    if (!candidateOverlaps(candidate, existing)) break
  }

  return { balloon: candidate ?? {
    id: state.nextBalloonId,
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    vx: BALLOON_RALLY_RULES.initialMinimumSpeed,
    vy: 0,
    radius: BALLOON_RALLY_RULES.visualRadius,
    hp: BALLOON_RALLY_RULES.ordinaryMaxHp,
    maxHp: BALLOON_RALLY_RULES.ordinaryMaxHp,
  }, randomState }
}

function populate(
  state: BalloonRallyState,
  region: LogicalPlayfieldRect,
): BalloonRallyState {
  let nextState = state
  let balloons = [...state.balloons]
  while (balloons.length < desiredPopulation(state.elapsedMs)) {
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

function applyContact(
  state: BalloonRallyState,
  contact: BalloonRallyContact,
  region: LogicalPlayfieldRect,
): BalloonRallyState {
  const target = state.balloons.find((balloon) => balloon.id === contact.balloonId)
  if (!target) return state

  const [impulseX, impulseY] = speedLimit(
    Number.isFinite(contact.impulse.x) ? contact.impulse.x : 0,
    Number.isFinite(contact.impulse.y) ? contact.impulse.y : 0,
    BALLOON_RALLY_RULES.maximumImpulse,
  )
  const [vx, vy] = speedLimit(
    target.vx + impulseX,
    target.vy + impulseY,
    state.partyRush
      ? BALLOON_RALLY_RULES.partyRushMaximumSpeed
      : BALLOON_RALLY_RULES.ordinaryMaximumSpeed,
  )
  const remainingHp = target.hp - 1
  const score = state.score + 1
  if (remainingHp > 0) {
    return {
      ...state,
      score,
      hits: state.hits + 1,
      balloons: state.balloons.map((balloon) =>
        balloon.id === target.id ? { ...balloon, hp: remainingHp, vx, vy } : balloon,
      ),
    }
  }

  const removed = state.balloons.filter((balloon) => balloon.id !== target.id)
  const stateAfterPop: BalloonRallyState = {
    ...state,
    score: score + 2,
    hits: state.hits + 1,
    pops: state.pops + 1,
    balloons: removed,
  }
  return populate(stateAfterPop, region)
}

function boostForPartyRush(state: BalloonRallyState): BalloonRallyState {
  return {
    ...state,
    partyRush: true,
    balloons: state.balloons.map((balloon) => {
      const [vx, vy] = speedLimit(
        balloon.vx * BALLOON_RALLY_RULES.partyRushSpeedBoost,
        balloon.vy * BALLOON_RALLY_RULES.partyRushSpeedBoost,
        BALLOON_RALLY_RULES.partyRushMaximumSpeed,
      )
      return { ...balloon, vx, vy }
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
    score: 0,
    hits: 0,
    pops: 0,
    partyRush: false,
    balloons: [],
    nextBalloonId: 1,
    randomState: seed,
    initialSeed: seed,
  })
}

/** Pure deterministic rules for the Camera AR Balloon Rally round. */
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
      return freezeState({
        ...state,
        countdownRemainingMs: state.countdownRemainingMs - deltaMs,
      })
    }
    state = {
      ...state,
      phase: 'PLAYING',
      countdownRemainingMs: 0,
    }
    state = populate(state, region)
    return advanceBalloonRally(state, {
      ...frame,
      deltaMs: deltaMs - inputState.countdownRemainingMs,
    })
  }

  const activeDeltaMs = Math.min(deltaMs, state.roundRemainingMs)
  const nextElapsedMs = state.elapsedMs + activeDeltaMs
  state = {
    ...state,
    elapsedMs: nextElapsedMs,
    roundRemainingMs: state.roundRemainingMs - activeDeltaMs,
  }
  state = populate(state, region)
  if (!state.partyRush && state.elapsedMs >= BALLOON_RALLY_RULES.partyRushStartMs) {
    state = boostForPartyRush(state)
  }

  for (const contact of frame.contacts) {
    state = applyContact(state, contact, region)
  }
  state = {
    ...state,
    balloons: state.balloons.map((balloon) =>
      integrateBalloon(balloon, region, activeDeltaMs, state.partyRush),
    ),
  }

  if (state.roundRemainingMs <= 0) {
    state = { ...state, phase: 'FINISHED', roundRemainingMs: 0 }
  }
  return freezeState(state)
}

export function replayBalloonRally(state: BalloonRallyState): BalloonRallyState {
  return createBalloonRallyState({ seed: state.initialSeed })
}
