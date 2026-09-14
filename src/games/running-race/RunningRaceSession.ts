import type {
  LocomotionSnapshot,
  LocomotionSnapshotSource,
  LocomotionStepSide,
} from '../../motion/contracts/locomotion'
import {
  advanceRunningRace,
  createRunningRaceState,
  replayRunningRace,
  type CreateRunningRaceStateOptions,
  type RunningInputSnapshot,
  type RunningRaceState,
} from './RunningRaceCore'

export interface RunningRaceTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface RunningRaceSessionOptions extends CreateRunningRaceStateOptions {}

type Listener = () => void

/** Bridges only the normalized D0 locomotion contract into Running Race. */
export class RunningRaceSession {
  readonly #source: LocomotionSnapshotSource
  readonly #listeners = new Set<Listener>()
  #state: RunningRaceState
  #running = false
  #lastSeenStepSequence = 0

  constructor(source: LocomotionSnapshotSource, options: RunningRaceSessionOptions = {}) {
    this.#source = source
    this.#state = createRunningRaceState(options)
  }

  readonly getState = (): RunningRaceState => this.#state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.#running = true
    this.#markCurrentStep(this.#source.getSnapshot())
  }

  async stop(): Promise<void> {
    this.#running = false
    this.#lastSeenStepSequence = 0
  }

  replay(): void {
    this.#state = replayRunningRace(this.#state)
    this.#markCurrentStep(this.#source.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: RunningRaceTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const input = this.#collectInput(this.#state.elapsedMs + safeDeltaMs)
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceRunningRace(this.#state, {
      deltaMs: safeDeltaMs,
      input,
    })
    this.#notify()
  }

  #collectInput(attemptTimestampMs: number): RunningInputSnapshot {
    const snapshot = this.#source.getSnapshot()
    const latestStep = this.#collectNewStep(snapshot)
    const available = snapshot.availability === 'AVAILABLE'
    return {
      timestampMs: Math.max(0, attemptTimestampMs),
      available,
      intensity: available ? clamp01(snapshot.intensity) : 0,
      speedMeter: available ? Math.round(clamp01(snapshot.intensity) * 100) : 0,
      ...(latestStep ? {
        newStepSide: latestStep.side,
        newStepSequence: latestStep.sequence,
      } : {}),
    }
  }

  #collectNewStep(snapshot: LocomotionSnapshot): { readonly side: LocomotionStepSide; readonly sequence: number } | null {
    const latestStep = snapshot.latestStep
    if (!latestStep || latestStep.sequence <= this.#lastSeenStepSequence) return null
    this.#lastSeenStepSequence = latestStep.sequence
    return { side: latestStep.side, sequence: latestStep.sequence }
  }

  #markCurrentStep(snapshot: LocomotionSnapshot): void {
    this.#lastSeenStepSequence = snapshot.latestStep?.sequence ?? 0
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}
