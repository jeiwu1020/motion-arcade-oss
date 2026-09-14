import {
  type SportsHandSide,
  type SportsMotionHandState,
  type SportsMotionSnapshot,
  type SportsMotionSnapshotSource,
  type SportsSwingEvent,
} from '../contracts/sportsMotion'
import { SPORTS_MOTION_CONFIG } from './sportsMotionConfig'

export interface AvailableSportsMotionKinematicHand {
  readonly availability: 'AVAILABLE'
  readonly x: number
  readonly y: number
  readonly confidence: number
  readonly aspectRatio: number
  readonly bodyScale: number
}

export interface UnavailableSportsMotionKinematicHand {
  readonly availability: 'UNAVAILABLE'
}

export type SportsMotionKinematicHand =
  | AvailableSportsMotionKinematicHand
  | UnavailableSportsMotionKinematicHand

/** Sanitized tracker input: no Pose frames, landmarks, or browser objects. */
export interface SportsMotionKinematicSample {
  readonly timestampMs: number
  readonly leftHand: SportsMotionKinematicHand
  readonly rightHand: SportsMotionKinematicHand
}

type DetectorState = 'IDLE' | 'CANDIDATE' | 'REFRACTORY'

interface PreviousHandSample {
  readonly timestampMs: number
  readonly x: number
  readonly y: number
  readonly confidence: number
  readonly aspectRatio: number
  readonly bodyScale: number
}

interface CandidateSwing {
  readonly sampleCount: number
  readonly cumulativeDisplacement: number
  readonly vectorX: number
  readonly vectorY: number
}

interface HandDetector {
  state: DetectorState
  previous: PreviousHandSample | null
  candidate: CandidateSwing | null
  refractoryUntilMs: number
  swingSequence: number
  latestSwing: SportsSwingEvent | null
}

function createDetector(): HandDetector {
  return {
    state: 'IDLE',
    previous: null,
    candidate: null,
    refractoryUntilMs: 0,
    swingSequence: 0,
    latestSwing: null,
  }
}

function unavailable(timestampMs: number, sequence: number): SportsMotionHandState {
  return Object.freeze({
    availability: 'UNAVAILABLE' as const,
    timestampMs,
    sequence,
  })
}

function emptySnapshot(): SportsMotionSnapshot {
  return Object.freeze({
    timestampMs: 0,
    sequence: 0,
    leftHand: unavailable(0, 0),
    rightHand: unavailable(0, 0),
    leftSwing: null,
    rightSwing: null,
  })
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampVector(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function validHand(
  hand: SportsMotionKinematicHand,
): hand is AvailableSportsMotionKinematicHand {
  return hand.availability === 'AVAILABLE' &&
    Number.isFinite(hand.x) && hand.x >= 0 && hand.x <= 1 &&
    Number.isFinite(hand.y) && hand.y >= 0 && hand.y <= 1 &&
    Number.isFinite(hand.confidence) && hand.confidence >= 0 && hand.confidence <= 1 &&
    Number.isFinite(hand.aspectRatio) && hand.aspectRatio > 0 &&
    Number.isFinite(hand.bodyScale) &&
    hand.bodyScale >= SPORTS_MOTION_CONFIG.minimumBodyScale
}

function intensityForSpeed(speed: number): number {
  const range =
    SPORTS_MOTION_CONFIG.fullIntensitySpeedBodyUnitsPerSecond -
    SPORTS_MOTION_CONFIG.enterSpeedBodyUnitsPerSecond
  if (range <= Number.EPSILON) return speed >= SPORTS_MOTION_CONFIG.fullIntensitySpeedBodyUnitsPerSecond ? 1 : 0
  return clamp01(
    (speed - SPORTS_MOTION_CONFIG.enterSpeedBodyUnitsPerSecond) / range,
  )
}

function resetDetector(detector: HandDetector, clearEvent = true): void {
  detector.state = 'IDLE'
  detector.previous = null
  detector.candidate = null
  detector.refractoryUntilMs = 0
  if (clearEvent) detector.latestSwing = null
}

function frozenEvent(
  hand: SportsHandSide,
  detector: HandDetector,
  timestampMs: number,
  vectorX: number,
  vectorY: number,
  speed: number,
): SportsSwingEvent {
  detector.swingSequence += 1
  return Object.freeze({
    sequence: detector.swingSequence,
    hand,
    timestampMs,
    vectorX: clampVector(vectorX),
    vectorY: clampVector(vectorY),
    speed,
    intensity: intensityForSpeed(speed),
  })
}

function frozenSnapshot(
  timestampMs: number,
  sequence: number,
  leftHand: SportsMotionHandState,
  rightHand: SportsMotionHandState,
  leftSwing: SportsSwingEvent | null,
  rightSwing: SportsSwingEvent | null,
): SportsMotionSnapshot {
  return Object.freeze({
    timestampMs,
    sequence,
    leftHand,
    rightHand,
    leftSwing,
    rightSwing,
  })
}

/**
 * Stateful broad-swing detector over sanitized, body-relative wrist samples.
 * It has no knowledge of Pose, MediaPipe, camera ownership, or sport rules.
 */
export class SportsMotionProvider implements SportsMotionSnapshotSource {
  readonly #listeners = new Set<() => void>()
  readonly #left = createDetector()
  readonly #right = createDetector()
  #sequence = 0
  #snapshot: SportsMotionSnapshot = emptySnapshot()

  getSnapshot(): SportsMotionSnapshot {
    return this.#snapshot
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  reset(timestampMs = 0): void {
    this.#sequence += 1
    resetDetector(this.#left)
    resetDetector(this.#right)
    this.#snapshot = frozenSnapshot(
      timestampMs,
      this.#sequence,
      unavailable(timestampMs, this.#sequence),
      unavailable(timestampMs, this.#sequence),
      null,
      null,
    )
    this.#notify()
  }

  ingest(sample: SportsMotionKinematicSample): void {
    const timestampMs = Number.isFinite(sample.timestampMs) ? sample.timestampMs : this.#snapshot.timestampMs
    const sequence = ++this.#sequence
    const leftHand = this.#ingestHand('LEFT', this.#left, sample.leftHand, timestampMs, sequence)
    const rightHand = this.#ingestHand('RIGHT', this.#right, sample.rightHand, timestampMs, sequence)
    this.#snapshot = frozenSnapshot(
      timestampMs,
      sequence,
      leftHand,
      rightHand,
      this.#left.latestSwing,
      this.#right.latestSwing,
    )
    this.#notify()
  }

  #ingestHand(
    hand: SportsHandSide,
    detector: HandDetector,
    input: SportsMotionKinematicHand,
    timestampMs: number,
    sequence: number,
  ): SportsMotionHandState {
    if (!validHand(input)) {
      // A transient loss removes usable kinematics. Its last occurrence remains
      // sequence-readable until a lifecycle/stale reset or replacement event.
      resetDetector(detector, false)
      return unavailable(timestampMs, sequence)
    }

    const current: PreviousHandSample = {
      timestampMs,
      x: input.x,
      y: input.y,
      confidence: input.confidence,
      aspectRatio: input.aspectRatio,
      bodyScale: input.bodyScale,
    }
    const previous = detector.previous
    detector.previous = current
    if (!previous || timestampMs <= previous.timestampMs ||
      timestampMs - previous.timestampMs > SPORTS_MOTION_CONFIG.maximumSampleGapMs) {
      resetDetector(detector)
      detector.previous = current
      return this.#availableState(input, timestampMs, sequence, 0, 0, 0)
    }

    const deltaSeconds = (timestampMs - previous.timestampMs) / 1_000
    const displacementX = ((input.x - previous.x) * input.aspectRatio) / input.bodyScale
    const displacementY = (input.y - previous.y) / input.bodyScale
    const displacement = Math.hypot(displacementX, displacementY)
    const velocityX = displacementX / deltaSeconds
    const velocityY = displacementY / deltaSeconds
    const speed = Math.hypot(velocityX, velocityY)
    const vectorX = speed > Number.EPSILON ? velocityX / speed : 0
    const vectorY = speed > Number.EPSILON ? velocityY / speed : 0
    this.#advanceDetector(
      hand,
      detector,
      timestampMs,
      speed,
      displacementX,
      displacementY,
      displacement,
      vectorX,
      vectorY,
    )
    return this.#availableState(input, timestampMs, sequence, velocityX, velocityY, speed)
  }

  #advanceDetector(
    hand: SportsHandSide,
    detector: HandDetector,
    timestampMs: number,
    speed: number,
    displacementX: number,
    displacementY: number,
    displacement: number,
    vectorX: number,
    vectorY: number,
  ): void {
    if (detector.state === 'REFRACTORY') {
      if (timestampMs >= detector.refractoryUntilMs &&
        speed <= SPORTS_MOTION_CONFIG.rearmSpeedBodyUnitsPerSecond) {
        detector.state = 'IDLE'
      }
      return
    }

    if (speed < SPORTS_MOTION_CONFIG.enterSpeedBodyUnitsPerSecond) {
      detector.state = 'IDLE'
      detector.candidate = null
      return
    }

    if (detector.state === 'IDLE') {
      detector.state = 'CANDIDATE'
      detector.candidate = {
        sampleCount: 1,
        cumulativeDisplacement: displacement,
        vectorX,
        vectorY,
      }
      return
    }

    const candidate = detector.candidate
    if (!candidate) {
      detector.state = 'IDLE'
      return
    }
    const alignment = candidate.vectorX * vectorX + candidate.vectorY * vectorY
    if (alignment < SPORTS_MOTION_CONFIG.minimumDirectionAlignment) {
      detector.state = 'IDLE'
      detector.candidate = null
      return
    }
    const cumulativeDisplacement = candidate.cumulativeDisplacement + Math.max(
      0,
      displacementX * candidate.vectorX + displacementY * candidate.vectorY,
    )
    const sampleCount = candidate.sampleCount + 1
    if (
      sampleCount >= SPORTS_MOTION_CONFIG.minimumActiveSamples &&
      cumulativeDisplacement >= SPORTS_MOTION_CONFIG.minimumCumulativeDisplacementBodyUnits
    ) {
      detector.latestSwing = frozenEvent(
        hand,
        detector,
        timestampMs,
        vectorX,
        vectorY,
        speed,
      )
      detector.state = 'REFRACTORY'
      detector.candidate = null
      detector.refractoryUntilMs = timestampMs + SPORTS_MOTION_CONFIG.refractoryMs
      return
    }
    detector.candidate = {
      sampleCount,
      cumulativeDisplacement,
      vectorX: candidate.vectorX,
      vectorY: candidate.vectorY,
    }
  }

  #availableState(
    input: AvailableSportsMotionKinematicHand,
    timestampMs: number,
    sequence: number,
    velocityX: number,
    velocityY: number,
    speed: number,
  ): SportsMotionHandState {
    const vectorX = speed > Number.EPSILON ? velocityX / speed : 0
    const vectorY = speed > Number.EPSILON ? velocityY / speed : 0
    return Object.freeze({
      availability: 'AVAILABLE' as const,
      x: input.x,
      y: input.y,
      confidence: clamp01(input.confidence),
      velocityX,
      velocityY,
      vectorX: clampVector(vectorX),
      vectorY: clampVector(vectorY),
      speed,
      intensity: intensityForSpeed(speed),
      timestampMs,
      sequence,
    })
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
