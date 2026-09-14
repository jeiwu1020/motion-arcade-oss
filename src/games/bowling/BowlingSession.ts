import type {
  SportsMotionSnapshot,
  SportsMotionSnapshotSource,
  SportsSwingEvent,
} from '../../motion/contracts/sportsMotion'
import {
  advanceBowling,
  createBowlingState,
  replayBowling,
  type BowlingState,
  type BowlingSwingAttempt,
  type CreateBowlingStateOptions,
} from './BowlingCore'

export interface BowlingTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface BowlingSessionOptions extends CreateBowlingStateOptions {}

type Listener = () => void

/**
 * Adapts the retained C0 Sports Motion snapshot into Bowling-local attempts.
 * The Core never receives the provider, snapshot, camera, or Pose data.
 */
export class BowlingSession {
  readonly #source: SportsMotionSnapshotSource
  readonly #listeners = new Set<Listener>()
  #state: BowlingState
  #running = false
  #lastSeenLeftSwingSequence = 0
  #lastSeenRightSwingSequence = 0

  constructor(source: SportsMotionSnapshotSource, options: BowlingSessionOptions = {}) {
    this.#source = source
    this.#state = createBowlingState(options)
  }

  readonly getState = (): BowlingState => this.#state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.#running = true
    this.#markCurrentSequences(this.#source.getSnapshot())
  }

  async stop(): Promise<void> {
    this.#running = false
    this.#lastSeenLeftSwingSequence = 0
    this.#lastSeenRightSwingSequence = 0
  }

  replay(): void {
    this.#state = replayBowling(this.#state)
    this.#markCurrentSequences(this.#source.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: BowlingTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    // Collect before readiness checks: retained events observed during a
    // recovery gap are consumed and can never fire after recovery.
    const attempts = this.#collectAttempts(this.#state.elapsedMs + safeDeltaMs)
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceBowling(this.#state, {
      deltaMs: safeDeltaMs,
      swingAttempts: attempts,
    })
    this.#notify()
  }

  #collectAttempts(attemptTimestampMs: number): readonly BowlingSwingAttempt[] {
    const snapshot = this.#source.getSnapshot()
    const attempts: BowlingSwingAttempt[] = []
    this.#collectEvent(snapshot.leftSwing, 'LEFT', attemptTimestampMs, attempts)
    this.#collectEvent(snapshot.rightSwing, 'RIGHT', attemptTimestampMs, attempts)
    return attempts
  }

  #collectEvent(
    event: SportsSwingEvent | null,
    hand: 'LEFT' | 'RIGHT',
    attemptTimestampMs: number,
    attempts: BowlingSwingAttempt[],
  ): void {
    if (!event || event.hand !== hand) return
    const lastSeen = hand === 'LEFT'
      ? this.#lastSeenLeftSwingSequence
      : this.#lastSeenRightSwingSequence
    if (event.sequence <= lastSeen) return
    if (hand === 'LEFT') this.#lastSeenLeftSwingSequence = event.sequence
    else this.#lastSeenRightSwingSequence = event.sequence
    attempts.push({
      hand,
      timestampMs: Math.max(0, attemptTimestampMs),
      vectorX: event.vectorX,
      vectorY: event.vectorY,
      intensity: event.intensity,
      sequence: event.sequence,
    })
  }

  #markCurrentSequences(snapshot: SportsMotionSnapshot): void {
    this.#lastSeenLeftSwingSequence = snapshot.leftSwing?.sequence ?? 0
    this.#lastSeenRightSwingSequence = snapshot.rightSwing?.sequence ?? 0
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
