import type {
  MotionInputProvider,
  MotionInputSnapshot,
} from '../../motion/contracts/motion'
import type {
  LocomotionSnapshot,
  LocomotionSnapshotSource,
  LocomotionStepEvent,
} from '../../motion/contracts/locomotion'
import {
  advanceLongJump,
  createLongJumpState,
  replayLongJump,
  type CreateLongJumpStateOptions,
  type LongJumpInputSnapshot,
  type LongJumpState,
} from './LongJumpCore'

export interface LongJumpTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface LongJumpSessionOptions extends CreateLongJumpStateOptions {}

type Listener = () => void

/** Bridges D0 locomotion and normalized JUMP into the small Long Jump input boundary. */
export class LongJumpSession {
  readonly #locomotionSource: LocomotionSnapshotSource
  readonly #motionProvider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: LongJumpState
  #running = false
  #lastSeenStepSequence = 0
  #lastSeenJumpSequence = 0

  constructor(
    locomotionSource: LocomotionSnapshotSource,
    motionProvider: MotionInputProvider,
    options: LongJumpSessionOptions = {},
  ) {
    this.#locomotionSource = locomotionSource
    this.#motionProvider = motionProvider
    this.#state = createLongJumpState(options)
  }

  readonly getState = (): LongJumpState => this.#state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.#running = true
    this.#markCurrentSequences(this.#locomotionSource.getSnapshot(), this.#motionProvider.getSnapshot())
  }

  async stop(): Promise<void> {
    this.#running = false
    this.#lastSeenStepSequence = 0
    this.#lastSeenJumpSequence = 0
  }

  replay(): void {
    this.#state = replayLongJump(this.#state)
    this.#markCurrentSequences(this.#locomotionSource.getSnapshot(), this.#motionProvider.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: LongJumpTrackingInput): void {
    if (!this.#running) return
    const locomotion = this.#locomotionSource.getSnapshot()
    const step = this.#collectNewStep(locomotion.latestStep)
    const jump = this.#collectNewJump(this.#motionProvider.getSnapshot())
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }

    const available = locomotion.availability === 'AVAILABLE'
    const input: LongJumpInputSnapshot = {
      locomotionAvailable: available,
      locomotionIntensity: available ? clamp01(locomotion.intensity) : 0,
      ...(available && step ? { newStepSide: step.side, newStepSequence: step.sequence } : {}),
      ...(this.#state.phase === 'TAKEOFF_WINDOW' && jump !== null ? { newJumpSequence: jump } : {}),
    }
    this.#state = advanceLongJump(this.#state, {
      deltaMs: safeDelta(deltaMs),
      input,
    })
    this.#notify()
  }

  #collectNewStep(latestStep: LocomotionStepEvent | null): LocomotionStepEvent | null {
    if (!latestStep || latestStep.sequence <= this.#lastSeenStepSequence) return null
    this.#lastSeenStepSequence = latestStep.sequence
    return latestStep
  }

  #collectNewJump(snapshot: MotionInputSnapshot): number | null {
    const action = snapshot.players[0]?.actions.JUMP
    if (!action || action.sequence <= this.#lastSeenJumpSequence) return null
    this.#lastSeenJumpSequence = action.sequence
    if (action.phase !== 'started' && action.phase !== 'active') return null
    return action.sequence
  }

  #markCurrentSequences(locomotion: LocomotionSnapshot, motion: MotionInputSnapshot): void {
    this.#lastSeenStepSequence = locomotion.latestStep?.sequence ?? 0
    this.#lastSeenJumpSequence = motion.players[0]?.actions.JUMP?.sequence ?? 0
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}

function safeDelta(deltaMs: number): number {
  return Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}
