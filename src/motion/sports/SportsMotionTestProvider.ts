import {
  type SportsHandSide,
  type SportsMotionHandState,
  type SportsMotionSnapshot,
  type SportsMotionSnapshotSource,
  type SportsSwingEvent,
} from '../contracts/sportsMotion'
import { SPORTS_MOTION_CONFIG } from './sportsMotionConfig'

export interface SportsMotionTestSwingOptions {
  readonly timestampMs: number
  readonly vectorX: number
  readonly vectorY: number
  readonly intensity: number
  readonly speed?: number
  readonly x?: number
  readonly y?: number
  readonly confidence?: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function unitVector(vectorX: number, vectorY: number): readonly [number, number] {
  const length = Math.hypot(vectorX, vectorY)
  if (!Number.isFinite(length) || length <= Number.EPSILON) return [0, 0]
  return length > 1 ? [vectorX / length, vectorY / length] : [vectorX, vectorY]
}

function unavailable(timestampMs: number, sequence: number): SportsMotionHandState {
  return Object.freeze({ availability: 'UNAVAILABLE' as const, timestampMs, sequence })
}

function snapshot(
  timestampMs: number,
  sequence: number,
  leftHand: SportsMotionHandState,
  rightHand: SportsMotionHandState,
  leftSwing: SportsSwingEvent | null,
  rightSwing: SportsSwingEvent | null,
): SportsMotionSnapshot {
  return Object.freeze({ timestampMs, sequence, leftHand, rightHand, leftSwing, rightSwing })
}

/** Camera-free deterministic source for future sports-game Session and Core tests. */
export class SportsMotionTestProvider implements SportsMotionSnapshotSource {
  readonly #listeners = new Set<() => void>()
  #sequence = 0
  #leftSwingSequence = 0
  #rightSwingSequence = 0
  #snapshot: SportsMotionSnapshot = snapshot(0, 0, unavailable(0, 0), unavailable(0, 0), null, null)

  getSnapshot(): SportsMotionSnapshot {
    return this.#snapshot
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  reset(timestampMs = 0): void {
    this.#sequence += 1
    this.#snapshot = snapshot(
      timestampMs,
      this.#sequence,
      unavailable(timestampMs, this.#sequence),
      unavailable(timestampMs, this.#sequence),
      null,
      null,
    )
    this.#notify()
  }

  triggerSwing(hand: SportsHandSide, options: SportsMotionTestSwingOptions): void {
    const timestampMs = Number.isFinite(options.timestampMs) ? options.timestampMs : this.#snapshot.timestampMs
    const intensity = clamp01(options.intensity)
    const [vectorX, vectorY] = unitVector(options.vectorX, options.vectorY)
    const speed = Number.isFinite(options.speed)
      ? Math.max(0, options.speed ?? 0)
      : SPORTS_MOTION_CONFIG.enterSpeedBodyUnitsPerSecond +
        intensity * (
          SPORTS_MOTION_CONFIG.fullIntensitySpeedBodyUnitsPerSecond -
          SPORTS_MOTION_CONFIG.enterSpeedBodyUnitsPerSecond
        )
    const sequence = ++this.#sequence
    const swingSequence = hand === 'LEFT'
      ? ++this.#leftSwingSequence
      : ++this.#rightSwingSequence
    const swing = Object.freeze({
      sequence: swingSequence,
      hand,
      timestampMs,
      vectorX,
      vectorY,
      speed,
      intensity,
    })
    const handState = Object.freeze({
      availability: 'AVAILABLE' as const,
      x: options.x ?? (hand === 'LEFT' ? 0.6 : 0.4),
      y: options.y ?? 0.57,
      confidence: clamp01(options.confidence ?? 1),
      velocityX: vectorX * speed,
      velocityY: vectorY * speed,
      vectorX,
      vectorY,
      speed,
      intensity,
      timestampMs,
      sequence,
    })
    this.#snapshot = hand === 'LEFT'
      ? snapshot(timestampMs, sequence, handState, this.#snapshot.rightHand, swing, this.#snapshot.rightSwing)
      : snapshot(timestampMs, sequence, this.#snapshot.leftHand, handState, this.#snapshot.leftSwing, swing)
    this.#notify()
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
