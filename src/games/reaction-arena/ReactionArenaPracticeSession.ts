import type {
  MotionActionId,
  MotionInputProvider,
  MotionInputSnapshot,
} from '../../motion/contracts/motion'
import {
  advanceReactionArenaPractice,
  createReactionArenaPracticeState,
  replayReactionArenaPractice,
  type ReactionArenaPracticeActionAttempt,
  type ReactionArenaPracticeState,
} from './ReactionArenaPracticeCore'

export interface ReactionArenaPracticeTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

type Listener = () => void

const REACTION_ACTIONS: readonly MotionActionId[] = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'REACH_LEFT',
  'REACH_RIGHT',
  'SQUAT',
]

/** Bridges the existing normalized action provider to non-timed practice mode. */
export class ReactionArenaPracticeSession {
  readonly mode = 'PRACTICE' as const
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: ReactionArenaPracticeState = createReactionArenaPracticeState()
  #running = false
  #lastSeenSequences = new Map<MotionActionId, number>()

  constructor(provider: MotionInputProvider) {
    this.#provider = provider
  }

  readonly getState = (): ReactionArenaPracticeState => this.#state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.#running = true
    this.#markCurrentSequences(this.#provider.getSnapshot())
  }

  async stop(): Promise<void> {
    this.#running = false
    this.#lastSeenSequences.clear()
  }

  replay(): void {
    this.#state = replayReactionArenaPractice()
    this.#markCurrentSequences(this.#provider.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: ReactionArenaPracticeTrackingInput): void {
    if (!this.#running) return
    const attempts = this.#collectAttempts()
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceReactionArenaPractice(this.#state, {
      deltaMs,
      actionAttempts: attempts,
    })
    this.#notify()
  }

  #collectAttempts(): readonly ReactionArenaPracticeActionAttempt[] {
    const player = this.#provider.getSnapshot().players[0]
    if (!player) return []
    const attempts: ReactionArenaPracticeActionAttempt[] = []
    for (const action of REACTION_ACTIONS) {
      const actionState = player.actions[action]
      if (!actionState) continue
      const priorSequence = this.#lastSeenSequences.get(action) ?? 0
      if (actionState.sequence <= priorSequence) continue
      this.#lastSeenSequences.set(action, actionState.sequence)
      if (actionState.phase !== 'started' && actionState.phase !== 'active') continue
      attempts.push({ action, sequence: actionState.sequence })
    }
    return attempts
  }

  #markCurrentSequences(snapshot: MotionInputSnapshot): void {
    this.#lastSeenSequences.clear()
    const player = snapshot.players[0]
    for (const action of REACTION_ACTIONS) {
      this.#lastSeenSequences.set(action, player?.actions[action]?.sequence ?? 0)
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
