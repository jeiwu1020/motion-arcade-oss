import type { MotionInputProvider, MotionInputSnapshot } from '../../motion/contracts/motion'
import {
  advanceVocalHop,
  createVocalHopState,
  replayVocalHop,
  vocalHopLiftLevel,
  VOCAL_HOP_RULES,
  type CreateVocalHopStateOptions,
  type VocalHopState,
} from './VocalHopCore'

export interface VocalHopTrackingInput {
  readonly setupReady: boolean
  readonly hardFailure: boolean
}

export interface VocalHopSessionOptions extends CreateVocalHopStateOptions {}

type Listener = () => void

function numericActionValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Bridges the existing normalized voice actions into the small Vocal Hop input. */
export class VocalHopSession {
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: VocalHopState
  #running = false
  #lastSeenTriggerSequence = 0

  constructor(provider: MotionInputProvider, options: VocalHopSessionOptions = {}) {
    this.#provider = provider
    this.#state = createVocalHopState(options)
  }

  readonly getState = (): VocalHopState => this.#state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.#running = true
    this.#markCurrentTrigger(this.#provider.getSnapshot())
  }

  async stop(): Promise<void> {
    this.#running = false
    this.#lastSeenTriggerSequence = 0
  }

  replay(): void {
    this.#state = replayVocalHop(this.#state)
    this.#markCurrentTrigger(this.#provider.getSnapshot())
    this.#notify()
  }

  tick(deltaMs: number, tracking: VocalHopTrackingInput): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const triggerSequence = this.#collectNewTrigger()
    const snapshot = this.#provider.getSnapshot()
    const actions = snapshot.players[0]?.actions
    const voiceLevel = Math.max(0, Math.min(1, numericActionValue(actions?.VOICE_LEVEL?.value)))
    const sustainedDurationSeconds = Math.max(
      0,
      Math.min(
        VOCAL_HOP_RULES.maximumSustainedDurationSeconds,
        numericActionValue(actions?.VOICE_SUSTAINED_DURATION?.value),
      ),
    )
    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#notify()
      return
    }
    this.#state = advanceVocalHop(this.#state, {
      deltaMs: safeDeltaMs,
      input: {
        ...(triggerSequence !== null ? { triggerSequence } : {}),
        liftLevel: vocalHopLiftLevel(voiceLevel),
        sustainedDurationSeconds,
      },
    })
    this.#notify()
  }

  #collectNewTrigger(): number | null {
    const action = this.#provider.getSnapshot().players[0]?.actions.VOICE_TRIGGER
    if (!action || action.sequence <= this.#lastSeenTriggerSequence) return null
    this.#lastSeenTriggerSequence = action.sequence
    if (action.phase !== 'started' && action.phase !== 'active') return null
    return action.sequence
  }

  #markCurrentTrigger(snapshot: MotionInputSnapshot): void {
    this.#lastSeenTriggerSequence = snapshot.players[0]?.actions.VOICE_TRIGGER?.sequence ?? 0
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
