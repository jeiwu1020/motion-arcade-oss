import type {
  LocomotionSnapshot,
  LocomotionSnapshotSource,
  LocomotionStepSide,
} from '../contracts/locomotion'
import { LOCOMOTION_CONFIG } from './locomotionConfig'
import { LocomotionProvider } from './LocomotionProvider'

export interface LocomotionTestStepOptions {
  readonly timestampMs: number
  readonly liftIntensity?: number
}

/** Deterministic, camera-free normalized locomotion source for future game tests. */
export class LocomotionTestProvider implements LocomotionSnapshotSource {
  readonly #provider = new LocomotionProvider()
  #lastTimestampMs: number | null = null

  getSnapshot(): LocomotionSnapshot {
    return this.#provider.getSnapshot(this.#lastTimestampMs ?? 0)
  }

  subscribe(listener: () => void): () => void {
    return this.#provider.subscribe(listener)
  }

  triggerStep(side: LocomotionStepSide, options: LocomotionTestStepOptions): void {
    const timestampMs = options.timestampMs
    if (!Number.isFinite(timestampMs)) return
    this.#advanceNeutralUntil(timestampMs - 2)
    const liftIntensity = clamp01(options.liftIntensity ?? 0.75)
    const targetSignal =
      LOCOMOTION_CONFIG.enterKneeDifferenceBodyUnits +
      liftIntensity *
        (LOCOMOTION_CONFIG.fullLiftDifferenceBodyUnits - LOCOMOTION_CONFIG.enterKneeDifferenceBodyUnits)
    const twoSampleEma = LOCOMOTION_CONFIG.smoothingAlpha * (2 - LOCOMOTION_CONFIG.smoothingAlpha)
    const rawMagnitude = targetSignal / twoSampleEma
    const raw = side === 'LEFT' ? rawMagnitude : -rawMagnitude
    this.#ingest(raw, timestampMs - 1)
    this.#ingest(raw, timestampMs)
  }

  setIdle(timestampMs: number): void {
    this.#advanceNeutralUntil(timestampMs)
  }

  reset(timestampMs = 0): void {
    this.#provider.reset(timestampMs)
    this.#lastTimestampMs = timestampMs
  }

  #advanceNeutralUntil(timestampMs: number): void {
    if (this.#lastTimestampMs === null) {
      this.#ingest(0, Math.max(0, timestampMs - 2))
    }
    while ((this.#lastTimestampMs ?? timestampMs) + 100 < timestampMs) {
      this.#ingest(0, (this.#lastTimestampMs ?? 0) + 100)
    }
    if ((this.#lastTimestampMs ?? timestampMs) < timestampMs) {
      this.#ingest(0, timestampMs)
    }
  }

  #ingest(rawKneeDifferenceBodyUnits: number, timestampMs: number): void {
    if (this.#lastTimestampMs !== null && timestampMs <= this.#lastTimestampMs) return
    this.#provider.ingest({ availability: 'AVAILABLE', timestampMs, rawKneeDifferenceBodyUnits })
    this.#lastTimestampMs = timestampMs
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
