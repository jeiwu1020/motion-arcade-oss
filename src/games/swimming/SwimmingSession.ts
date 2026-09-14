import type {
  SportsMotionSnapshot,
  SportsMotionSnapshotSource,
  SportsSwingEvent,
} from '../../motion/contracts/sportsMotion'
import {
  advanceSwimming,
  createSwimmingState,
  replaySwimming,
  type CreateSwimmingStateOptions,
  type SwimmingInputSnapshot,
  type SwimmingState,
} from './SwimmingCore'
import {
  acceptSwimmingStroke,
  createSwimmingStrokeCycle,
  swimmingPropulsionAt,
  type SwimmingStrokeAttempt,
  type SwimmingStrokeCycleState,
} from './SwimmingStrokeCycle'

export interface SwimmingTrackingInput { readonly setupReady: boolean; readonly hardFailure: boolean }
export interface SwimmingSessionOptions extends CreateSwimmingStateOptions {}
type Listener = () => void

/** C0 retained swing events become game-local alternating strokes here. */
export class SwimmingSession {
  readonly #source: SportsMotionSnapshotSource
  readonly #listeners = new Set<Listener>()
  #state: SwimmingState
  #cycle: SwimmingStrokeCycleState = createSwimmingStrokeCycle()
  #cycleClockMs = 0
  #running = false
  #lastSeenLeftSwingSequence = 0
  #lastSeenRightSwingSequence = 0
  #hintSequence = 0

  constructor(source: SportsMotionSnapshotSource, options: SwimmingSessionOptions = {}) {
    this.#source = source
    this.#state = createSwimmingState(options)
  }

  readonly getState = (): SwimmingState => this.#state
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
    this.#cycle = createSwimmingStrokeCycle()
    this.#cycleClockMs = 0
  }

  replay(): void {
    this.#state = replaySwimming(this.#state)
    this.#cycle = createSwimmingStrokeCycle()
    this.#cycleClockMs = 0
    this.#hintSequence = 0
    this.#markCurrentSequences(this.#source.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: SwimmingTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const events = this.#collectNewEvents()
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }

    const playingDeltaMs = this.#state.phase === 'PLAYING'
      ? safeDeltaMs
      : Math.max(0, safeDeltaMs - this.#state.countdownRemainingMs)
    this.#cycleClockMs += playingDeltaMs
    let acceptedStroke: SwimmingInputSnapshot['acceptedStroke']
    let otherHandHint: SwimmingInputSnapshot['otherHandHint']
    if (this.#state.phase === 'PLAYING') {
      for (const event of events) {
        const attempt: SwimmingStrokeAttempt = {
          side: event.hand,
          timestampMs: this.#cycleClockMs,
          intensity: event.intensity,
          sequence: event.sequence,
          vectorX: event.vectorX,
          vectorY: event.vectorY,
        }
        const result = acceptSwimmingStroke(this.#cycle, attempt)
        this.#cycle = result.state
        if (result.outcome === 'ACCEPTED') {
          acceptedStroke = {
            side: event.hand,
            sequence: this.#cycle.acceptedStrokeCount,
            intensity: event.intensity,
            vectorY: event.vectorY,
            alternatingStreak: this.#cycle.currentAlternatingStreak,
          }
        } else if (result.outcome === 'WRONG_SIDE') {
          otherHandHint = { side: event.hand, sequence: ++this.#hintSequence }
        }
      }
    }
    const propulsion = swimmingPropulsionAt(this.#cycle, this.#cycleClockMs)
    this.#state = advanceSwimming(this.#state, {
      deltaMs: safeDeltaMs,
      input: {
        timestampMs: this.#cycleClockMs,
        available: true,
        propulsion,
        speedMeter: Math.round(propulsion * 100),
        ...(acceptedStroke ? { acceptedStroke } : {}),
        ...(otherHandHint ? { otherHandHint } : {}),
      },
    })
    this.#notify()
  }

  #collectNewEvents(): readonly SportsSwingEvent[] {
    const snapshot = this.#source.getSnapshot()
    const events: SportsSwingEvent[] = []
    this.#collectEvent(snapshot.leftSwing, 'LEFT', events)
    this.#collectEvent(snapshot.rightSwing, 'RIGHT', events)
    return events.sort((left, right) => left.timestampMs - right.timestampMs || (left.hand === 'LEFT' ? -1 : 1))
  }

  #collectEvent(event: SportsSwingEvent | null, hand: 'LEFT' | 'RIGHT', events: SportsSwingEvent[]): void {
    if (!event || event.hand !== hand) return
    const lastSeen = hand === 'LEFT' ? this.#lastSeenLeftSwingSequence : this.#lastSeenRightSwingSequence
    if (event.sequence <= lastSeen) return
    if (hand === 'LEFT') this.#lastSeenLeftSwingSequence = event.sequence
    else this.#lastSeenRightSwingSequence = event.sequence
    events.push(event)
  }

  #markCurrentSequences(snapshot: SportsMotionSnapshot): void {
    this.#lastSeenLeftSwingSequence = snapshot.leftSwing?.sequence ?? 0
    this.#lastSeenRightSwingSequence = snapshot.rightSwing?.sequence ?? 0
  }

  #notify(): void { for (const listener of this.#listeners) listener() }
}
