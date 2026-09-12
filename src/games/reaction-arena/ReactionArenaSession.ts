import type {
  MotionActionId,
  MotionInputProvider,
  MotionInputSnapshot,
} from '../../motion/contracts/motion'
import {
  advanceReactionArena,
  createReactionArenaState,
  replayReactionArena,
  type CreateReactionArenaStateOptions,
  type ReactionArenaActionAttempt,
  type ReactionArenaState,
} from './ReactionArenaCore'

export interface ReactionArenaTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface ReactionArenaSessionOptions extends CreateReactionArenaStateOptions {}

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

/** Bridges normalized MotionInput snapshots to the framework-independent core. */
export class ReactionArenaSession {
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: ReactionArenaState
  #running = false
  #lastSeenSequences = new Map<MotionActionId, number>()

  constructor(provider: MotionInputProvider, options: ReactionArenaSessionOptions = {}) {
    this.#provider = provider
    this.#state = createReactionArenaState(options)
  }

  readonly getState = (): ReactionArenaState => this.#state

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
    this.#state = replayReactionArena(this.#state)
    this.#markCurrentSequences(this.#provider.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: ReactionArenaTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const attempts = this.#collectAttempts(safeDeltaMs)

    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }

    this.#state = advanceReactionArena(this.#state, {
      deltaMs: safeDeltaMs,
      actionAttempts: attempts,
    })
    this.#notify()
  }

  #collectAttempts(deltaMs: number): readonly ReactionArenaActionAttempt[] {
    const snapshot = this.#provider.getSnapshot()
    const player = snapshot.players[0]
    if (!player) return []
    const attempts: ReactionArenaActionAttempt[] = []
    for (const action of REACTION_ACTIONS) {
      const actionState = player.actions[action]
      if (!actionState) continue
      const priorSequence = this.#lastSeenSequences.get(action) ?? 0
      if (actionState.sequence <= priorSequence) continue
      this.#lastSeenSequences.set(action, actionState.sequence)
      if (actionState.phase !== 'started' && actionState.phase !== 'active') continue
      attempts.push({
        action,
        sequence: actionState.sequence,
        atMs: this.#state.elapsedMs + deltaMs,
      })
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
