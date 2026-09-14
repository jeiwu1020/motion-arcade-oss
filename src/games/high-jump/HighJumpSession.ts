import type { MotionInputProvider, MotionInputSnapshot } from '../../motion/contracts/motion'
import {
  advanceHighJump,
  createHighJumpState,
  replayHighJump,
  type CreateHighJumpStateOptions,
  type HighJumpState,
} from './HighJumpCore'

export interface HighJumpTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface HighJumpSessionOptions extends CreateHighJumpStateOptions {}

type Listener = () => void

/** Bridges only fresh normalized JUMP occurrences into the timing Core. */
export class HighJumpSession {
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: HighJumpState
  #running = false
  #lastSeenJumpSequence = 0

  constructor(provider: MotionInputProvider, options: HighJumpSessionOptions = {}) {
    this.#provider = provider
    this.#state = createHighJumpState(options)
  }

  readonly getState = (): HighJumpState => this.#state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.#running = true
    this.#markCurrentJump(this.#provider.getSnapshot())
  }

  async stop(): Promise<void> {
    this.#running = false
    this.#lastSeenJumpSequence = 0
  }

  replay(): void {
    this.#state = replayHighJump(this.#state)
    this.#markCurrentJump(this.#provider.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: HighJumpTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const jump = this.#collectNewJump()
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceHighJump(this.#state, {
      deltaMs: safeDeltaMs,
      ...(jump && this.#state.phase === 'APPROACH' ? { input: { sequence: jump } } : {}),
    })
    this.#notify()
  }

  #collectNewJump(): number | null {
    const action = this.#provider.getSnapshot().players[0]?.actions.JUMP
    if (!action || action.sequence <= this.#lastSeenJumpSequence) return null
    this.#lastSeenJumpSequence = action.sequence
    if (action.phase !== 'started' && action.phase !== 'active') return null
    return action.sequence
  }

  #markCurrentJump(snapshot: MotionInputSnapshot): void {
    this.#lastSeenJumpSequence = snapshot.players[0]?.actions.JUMP?.sequence ?? 0
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
