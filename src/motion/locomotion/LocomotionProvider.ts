import {
  type LocomotionSnapshot,
  type LocomotionSnapshotSource,
  type LocomotionStepEvent,
  type LocomotionStepSide,
} from '../contracts/locomotion'
import { LOCOMOTION_CONFIG } from './locomotionConfig'

export interface AvailableLocomotionKinematicSample {
  readonly availability: 'AVAILABLE'
  readonly timestampMs: number
  /** (rightKnee.y - leftKnee.y) / bodyScale in canonical source coordinates. */
  readonly rawKneeDifferenceBodyUnits: number
}

export interface UnavailableLocomotionKinematicSample {
  readonly availability: 'UNAVAILABLE'
  readonly timestampMs: number
}

/** Sanitized tracker input: no Pose frames, landmarks, camera, or body measurements. */
export type LocomotionKinematicSample =
  | AvailableLocomotionKinematicSample
  | UnavailableLocomotionKinematicSample

interface Candidate {
  readonly side: LocomotionStepSide
  readonly sampleCount: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function emptySnapshot(timestampMs = 0, sequence = 0): LocomotionSnapshot {
  return Object.freeze({
    timestampMs,
    sequence,
    availability: 'UNAVAILABLE' as const,
    cadenceSpm: 0,
    intensity: 0,
    latestStep: null,
  })
}

function eventFor(
  sequence: number,
  side: LocomotionStepSide,
  timestampMs: number,
  signal: number,
): LocomotionStepEvent {
  const range =
    LOCOMOTION_CONFIG.fullLiftDifferenceBodyUnits -
    LOCOMOTION_CONFIG.enterKneeDifferenceBodyUnits
  return Object.freeze({
    sequence,
    side,
    timestampMs,
    liftIntensity: range <= Number.EPSILON
      ? 1
      : clamp01((Math.abs(signal) - LOCOMOTION_CONFIG.enterKneeDifferenceBodyUnits) / range),
  })
}

/**
 * Stateful alternating knee-lift detector over sanitized body-relative data.
 * It intentionally knows nothing about Pose, cameras, inference, or game rules.
 */
export class LocomotionProvider implements LocomotionSnapshotSource {
  readonly #listeners = new Set<() => void>()
  #snapshot: LocomotionSnapshot = emptySnapshot()
  #sequence = 0
  #stepSequence = 0
  #lastTimestampMs: number | null = null
  #neutralDifference: number | null = null
  #smoothedSignal = 0
  #candidate: Candidate | null = null
  #lastAcceptedSide: LocomotionStepSide | null = null
  #acceptedStepTimes: number[] = []
  #lastStepTimestampMs: number | null = null
  #latestStep: LocomotionStepEvent | null = null

  getSnapshot(nowMs = this.#snapshot.timestampMs): LocomotionSnapshot {
    if (
      this.#snapshot.availability === 'AVAILABLE' &&
      this.#lastTimestampMs !== null &&
      nowMs - this.#lastTimestampMs > LOCOMOTION_CONFIG.maximumContinuityGapMs
    ) {
      this.reset(nowMs)
    }
    return this.#snapshot
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  reset(timestampMs = 0): void {
    this.#sequence += 1
    this.#lastTimestampMs = null
    this.#neutralDifference = null
    this.#smoothedSignal = 0
    this.#candidate = null
    this.#lastAcceptedSide = null
    this.#acceptedStepTimes = []
    this.#lastStepTimestampMs = null
    this.#latestStep = null
    this.#snapshot = emptySnapshot(timestampMs, this.#sequence)
    this.#notify()
  }

  ingest(sample: LocomotionKinematicSample): void {
    const timestampMs = Number.isFinite(sample.timestampMs)
      ? sample.timestampMs
      : this.#snapshot.timestampMs
    if (
      this.#lastTimestampMs !== null &&
      (timestampMs <= this.#lastTimestampMs ||
        timestampMs - this.#lastTimestampMs > LOCOMOTION_CONFIG.maximumContinuityGapMs)
    ) {
      this.reset(timestampMs)
      return
    }
    if (sample.availability !== 'AVAILABLE' || !Number.isFinite(sample.rawKneeDifferenceBodyUnits)) {
      this.reset(timestampMs)
      return
    }

    this.#lastTimestampMs = timestampMs
    const rawDifference = sample.rawKneeDifferenceBodyUnits
    if (this.#neutralDifference === null) {
      this.#neutralDifference = rawDifference
      this.#smoothedSignal = 0
      this.#publish(timestampMs)
      return
    }

    const rawSignal = rawDifference - this.#neutralDifference
    this.#smoothedSignal =
      LOCOMOTION_CONFIG.smoothingAlpha * rawSignal +
      (1 - LOCOMOTION_CONFIG.smoothingAlpha) * this.#smoothedSignal
    if (Math.abs(this.#smoothedSignal) <= LOCOMOTION_CONFIG.exitKneeDifferenceBodyUnits) {
      this.#neutralDifference +=
        LOCOMOTION_CONFIG.neutralAdaptationAlpha * (rawDifference - this.#neutralDifference)
    }

    this.#advanceDetector(timestampMs, rawSignal)
    this.#publish(timestampMs)
  }

  /** Camera-free providers may advance an otherwise neutral input stream. */
  idle(timestampMs: number): void {
    this.ingest({
      availability: 'AVAILABLE',
      timestampMs,
      rawKneeDifferenceBodyUnits: this.#neutralDifference ?? 0,
    })
  }

  #advanceDetector(timestampMs: number, rawSignal: number): void {
    const side = this.#dominantSide(rawSignal)
    if (!side) {
      if (Math.abs(this.#smoothedSignal) <= LOCOMOTION_CONFIG.exitKneeDifferenceBodyUnits) {
        this.#candidate = null
      }
      return
    }
    if (side === this.#lastAcceptedSide) {
      this.#candidate = null
      return
    }
    if (!this.#candidate || this.#candidate.side !== side) {
      this.#candidate = { side, sampleCount: 1 }
      return
    }
    const sampleCount = this.#candidate.sampleCount + 1
    if (sampleCount < LOCOMOTION_CONFIG.minimumCandidateSamples) {
      this.#candidate = { side, sampleCount }
      return
    }
    this.#candidate = null
    if (
      this.#lastStepTimestampMs !== null &&
      timestampMs - this.#lastStepTimestampMs < LOCOMOTION_CONFIG.minimumStepIntervalMs
    ) {
      return
    }
    this.#stepSequence += 1
    this.#latestStep = eventFor(this.#stepSequence, side, timestampMs, this.#smoothedSignal)
    this.#lastAcceptedSide = side
    this.#recordStep(timestampMs)
  }

  #dominantSide(rawSignal: number): LocomotionStepSide | null {
    const enter = LOCOMOTION_CONFIG.enterKneeDifferenceBodyUnits
    // Raw dominance permits a clear opposite-side transition to re-arm even
    // while the bounded EMA is crossing the neutral region.
    if (this.#smoothedSignal >= enter || rawSignal >= enter) return 'LEFT'
    if (this.#smoothedSignal <= -enter || rawSignal <= -enter) return 'RIGHT'
    return null
  }

  #recordStep(timestampMs: number): void {
    const previous = this.#lastStepTimestampMs
    this.#lastStepTimestampMs = timestampMs
    if (previous === null) {
      this.#acceptedStepTimes = [timestampMs]
      return
    }
    const interval = timestampMs - previous
    if (interval > LOCOMOTION_CONFIG.maximumCadenceIntervalMs) {
      this.#acceptedStepTimes = [timestampMs]
      return
    }
    this.#acceptedStepTimes = [
      ...this.#acceptedStepTimes,
      timestampMs,
    ].slice(-LOCOMOTION_CONFIG.cadenceWindowStepCount)
  }

  #cadenceAt(timestampMs: number): number {
    const latest = this.#lastStepTimestampMs
    if (latest === null || this.#acceptedStepTimes.length < 2) return 0
    const sinceLatest = Math.max(0, timestampMs - latest)
    if (sinceLatest >= LOCOMOTION_CONFIG.cadenceZeroAfterMs) return 0
    const intervals: number[] = []
    for (let index = 1; index < this.#acceptedStepTimes.length; index += 1) {
      const current = this.#acceptedStepTimes[index]
      const previous = this.#acceptedStepTimes[index - 1]
      if (current !== undefined && previous !== undefined) intervals.push(current - previous)
    }
    const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const baseCadence = clamp(60_000 / meanInterval, 0, LOCOMOTION_CONFIG.maximumCadenceSpm)
    if (sinceLatest <= LOCOMOTION_CONFIG.cadenceHoldMs) return baseCadence
    const decaySpan = LOCOMOTION_CONFIG.cadenceZeroAfterMs - LOCOMOTION_CONFIG.cadenceHoldMs
    return baseCadence * clamp01((LOCOMOTION_CONFIG.cadenceZeroAfterMs - sinceLatest) / decaySpan)
  }

  #publish(timestampMs: number): void {
    this.#sequence += 1
    const cadenceSpm = this.#cadenceAt(timestampMs)
    this.#snapshot = Object.freeze({
      timestampMs,
      sequence: this.#sequence,
      availability: 'AVAILABLE' as const,
      cadenceSpm,
      intensity: clamp01(cadenceSpm / LOCOMOTION_CONFIG.fullIntensityCadenceSpm),
      latestStep: this.#latestStep,
    })
    this.#notify()
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
