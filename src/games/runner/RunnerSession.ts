import type {
  MotionActionId,
  MotionInputProvider,
  MotionInputSnapshot,
} from '../../motion/contracts/motion'
import {
  advanceRunner,
  createRunnerState,
  replayRunner,
  type CreateRunnerStateOptions,
  type RunnerInputAction,
  type RunnerState,
} from './RunnerCore'

export interface RunnerTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface RunnerSessionOptions extends CreateRunnerStateOptions {}

type Listener = () => void

const RUNNER_ACTIONS: readonly RunnerInputAction[] = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'JUMP',
  'SQUAT',
]

export class RunnerSession {
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: RunnerState
  #running = false
  #lastSeenSequences = new Map<MotionActionId, number>()

  constructor(provider: MotionInputProvider, options: RunnerSessionOptions = {}) {
    this.#provider = provider
    this.#state = createRunnerState(options)
  }

  readonly getState = (): RunnerState => this.#state

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
    this.#state = replayRunner(this.#state)
    this.#markCurrentSequences(this.#provider.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: RunnerTrackingInput): void {
    if (!this.#running) return
    const actions = this.#collectActions()
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceRunner(this.#state, {
      deltaMs: Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0),
      actions,
    })
    this.#notify()
  }

  #collectActions(): readonly RunnerInputAction[] {
    const player = this.#provider.getSnapshot().players[0]
    if (!player) return []
    const actions: RunnerInputAction[] = []
    for (const action of RUNNER_ACTIONS) {
      const actionState = player.actions[action]
      if (!actionState) continue
      const previousSequence = this.#lastSeenSequences.get(action) ?? 0
      if (actionState.sequence <= previousSequence) continue
      this.#lastSeenSequences.set(action, actionState.sequence)
      if (actionState.phase !== 'started' && actionState.phase !== 'active') continue
      actions.push(action)
    }
    return actions
  }

  #markCurrentSequences(snapshot: MotionInputSnapshot): void {
    this.#lastSeenSequences.clear()
    const player = snapshot.players[0]
    for (const action of RUNNER_ACTIONS) {
      this.#lastSeenSequences.set(action, player?.actions[action]?.sequence ?? 0)
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
