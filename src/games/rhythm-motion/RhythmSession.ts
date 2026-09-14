import type {
  MotionActionId,
  MotionInputProvider,
  MotionInputSnapshot,
} from '../../motion/contracts/motion'
import {
  advanceRhythm,
  createRhythmState,
  replayRhythm,
  type CreateRhythmStateOptions,
  type RhythmAction,
  type RhythmActionAttempt,
  type RhythmState,
} from './RhythmCore'

export interface RhythmTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface RhythmSessionOptions extends CreateRhythmStateOptions {}

type Listener = () => void

const RHYTHM_PROVIDER_ACTIONS: readonly MotionActionId[] = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'REACH_LEFT',
  'REACH_RIGHT',
]

export function normalizeRhythmAction(action: MotionActionId): RhythmAction | null {
  switch (action) {
    case 'MOVE_LEFT':
    case 'LEAN_LEFT': return 'LEFT'
    case 'MOVE_RIGHT':
    case 'LEAN_RIGHT': return 'RIGHT'
    case 'REACH_LEFT': return 'REACH_LEFT'
    case 'REACH_RIGHT': return 'REACH_RIGHT'
    default: return null
  }
}

export class RhythmSession {
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: RhythmState
  #running = false
  #lastSeenSequences = new Map<MotionActionId, number>()

  constructor(provider: MotionInputProvider, options: RhythmSessionOptions = {}) {
    this.#provider = provider
    this.#state = createRhythmState(options)
  }

  readonly getState = (): RhythmState => this.#state

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
    this.#state = replayRhythm(this.#state)
    this.#markCurrentSequences(this.#provider.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: RhythmTrackingInput): void {
    if (!this.#running) return
    const attempts = this.#collectAttempts()
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceRhythm(this.#state, {
      deltaMs: Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0),
      actionAttempts: attempts,
    })
    this.#notify()
  }

  #collectAttempts(): readonly RhythmActionAttempt[] {
    const player = this.#provider.getSnapshot().players[0]
    if (!player) return []
    const attempts: RhythmActionAttempt[] = []
    for (const providerAction of RHYTHM_PROVIDER_ACTIONS) {
      const actionState = player.actions[providerAction]
      if (!actionState) continue
      const previousSequence = this.#lastSeenSequences.get(providerAction) ?? 0
      if (actionState.sequence <= previousSequence) continue
      this.#lastSeenSequences.set(providerAction, actionState.sequence)
      if (actionState.phase !== 'started' && actionState.phase !== 'active') continue
      const action = normalizeRhythmAction(providerAction)
      if (action) attempts.push({ action, sequence: actionState.sequence, atMs: this.#state.elapsedMs })
    }
    return attempts
  }

  #markCurrentSequences(snapshot: MotionInputSnapshot): void {
    this.#lastSeenSequences.clear()
    const player = snapshot.players[0]
    for (const action of RHYTHM_PROVIDER_ACTIONS) {
      this.#lastSeenSequences.set(action, player?.actions[action]?.sequence ?? 0)
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
