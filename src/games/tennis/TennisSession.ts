import type {
  SportsMotionSnapshot,
  SportsMotionSnapshotSource,
  SportsSwingEvent,
} from '../../motion/contracts/sportsMotion'
import {
  advanceTennis,
  createTennisState,
  replayTennis,
  type CreateTennisStateOptions,
  type TennisState,
  type TennisSwingAttempt,
} from './TennisCore'

export interface TennisTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface TennisSessionOptions extends CreateTennisStateOptions {}

type Listener = () => void

/**
 * Bridges only the immutable Sports Motion snapshot into Tennis-local swing
 * attempts. The Core never sees the provider or its retained snapshot.
 */
export class TennisSession {
  readonly #source: SportsMotionSnapshotSource
  readonly #listeners = new Set<Listener>()
  #state: TennisState
  #running = false
  #lastSeenLeftSwingSequence = 0
  #lastSeenRightSwingSequence = 0

  constructor(source: SportsMotionSnapshotSource, options: TennisSessionOptions = {}) {
    this.#source = source
    this.#state = createTennisState(options)
  }

  readonly getState = (): TennisState => this.#state

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
    this.#state = replayTennis(this.#state)
    this.#markCurrentSequences(this.#source.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: TennisTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const attempts = this.#collectAttempts(this.#state.elapsedMs + safeDeltaMs)
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceTennis(this.#state, {
      deltaMs: safeDeltaMs,
      swingAttempts: attempts,
    })
    this.#notify()
  }

  #collectAttempts(attemptTimestampMs: number): readonly TennisSwingAttempt[] {
    const snapshot = this.#source.getSnapshot()
    const attempts: TennisSwingAttempt[] = []
    this.#collectEvent(snapshot.leftSwing, 'LEFT', attemptTimestampMs, attempts)
    this.#collectEvent(snapshot.rightSwing, 'RIGHT', attemptTimestampMs, attempts)
    return attempts
  }

  #collectEvent(
    event: SportsSwingEvent | null,
    hand: 'LEFT' | 'RIGHT',
    attemptTimestampMs: number,
    attempts: TennisSwingAttempt[],
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
      // Core timing is deliberately game-local; the source timestamp is used
      // by the foundation for ordering, while the Session stamps the attempt
      // at the current deterministic round time.
      timestampMs: Math.max(0, Math.min(60_000, attemptTimestampMs)),
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
