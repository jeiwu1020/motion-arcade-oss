import type {
  SportsMotionSnapshot,
  SportsMotionSnapshotSource,
  SportsSwingEvent,
} from '../../motion/contracts/sportsMotion'
import {
  BASEBALL_RULES,
  advanceBaseball,
  createBaseballState,
  replayBaseball,
  type BaseballState,
  type BaseballSwingAttempt,
  type CreateBaseballStateOptions,
} from './BaseballCore'

export interface BaseballTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface BaseballSessionOptions extends CreateBaseballStateOptions {}

type Listener = () => void

/** Bridges retained C0 swing occurrences into Baseball-local attempts. */
export class BaseballSession {
  readonly #source: SportsMotionSnapshotSource
  readonly #listeners = new Set<Listener>()
  #state: BaseballState
  #running = false
  #lastSeenLeftSwingSequence = 0
  #lastSeenRightSwingSequence = 0

  constructor(
    source: SportsMotionSnapshotSource,
    options: BaseballSessionOptions = {},
  ) {
    this.#source = source
    this.#state = createBaseballState(options)
  }

  readonly getState = (): BaseballState => this.#state

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
    this.#state = replayBaseball(this.#state)
    this.#markCurrentSequences(this.#source.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: BaseballTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const attempts = this.#collectAttempts(
      Math.min(BASEBALL_RULES.roundMs, this.#state.elapsedMs + safeDeltaMs),
    )
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceBaseball(this.#state, {
      deltaMs: safeDeltaMs,
      swingAttempts: attempts,
    })
    this.#notify()
  }

  #collectAttempts(attemptTimestampMs: number): readonly BaseballSwingAttempt[] {
    const snapshot = this.#source.getSnapshot()
    const attempts: BaseballSwingAttempt[] = []
    this.#collectEvent(snapshot.leftSwing, 'LEFT', attemptTimestampMs, attempts)
    this.#collectEvent(snapshot.rightSwing, 'RIGHT', attemptTimestampMs, attempts)
    return attempts
  }

  #collectEvent(
    event: SportsSwingEvent | null,
    hand: 'LEFT' | 'RIGHT',
    attemptTimestampMs: number,
    attempts: BaseballSwingAttempt[],
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
      // C0 timestamps order retained events. Core timing remains deterministic
      // and is stamped at the current game-local clock by this Session.
      timestampMs: attemptTimestampMs,
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
