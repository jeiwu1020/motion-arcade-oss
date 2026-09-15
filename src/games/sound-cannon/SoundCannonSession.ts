import type { MotionInputProvider, MotionInputSnapshot } from '../../motion/contracts/motion'
import {
  advanceSoundCannon,
  createSoundCannonState,
  replaySoundCannon,
  SOUND_CANNON_RULES,
  type CreateSoundCannonStateOptions,
  type SoundCannonState,
} from './SoundCannonCore'
import { SoundCannonVoiceCycle } from './SoundCannonVoiceCycle'

export interface SoundCannonTrackingInput { readonly setupReady: boolean; readonly hardFailure: boolean }
export interface SoundCannonSessionOptions extends CreateSoundCannonStateOptions {}
type Listener = () => void
function numeric(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }

/** Converts existing F0 voice actions into game-local charge and fire events. */
export class SoundCannonSession {
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  readonly #cycle = new SoundCannonVoiceCycle()
  #state: SoundCannonState
  #running = false
  #lastSeenTriggerSequence = 0

  constructor(provider: MotionInputProvider, options: SoundCannonSessionOptions = {}) { this.#provider = provider; this.#state = createSoundCannonState(options) }
  readonly getState = (): SoundCannonState => this.#state
  readonly subscribe = (listener: Listener): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }
  async start(): Promise<void> { this.#running = true; this.#markCurrentTrigger(this.#provider.getSnapshot()); this.#cycle.reset() }
  async stop(): Promise<void> { this.#running = false; this.#lastSeenTriggerSequence = 0; this.#cycle.reset() }
  replay(): void { this.#state = replaySoundCannon(this.#state); this.#cycle.reset(); this.#markCurrentTrigger(this.#provider.getSnapshot()); this.#notify() }

  tick(deltaMs: number, tracking: SoundCannonTrackingInput): void {
    if (!this.#running || this.#state.phase === 'FINISHED') return
    const safeDelta = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const trigger = this.#collectNewTrigger()
    if (tracking.hardFailure || !tracking.setupReady) {
      this.#cycle.reset()
      this.#notify()
      return
    }
    if (this.#state.phase !== 'PLAYING') {
      this.#state = advanceSoundCannon(this.#state, { deltaMs: safeDelta })
      this.#notify()
      return
    }
    const nextClock = Math.min(SOUND_CANNON_RULES.roundMs, this.#state.elapsedMs + safeDelta)
    const cycle = this.#cycle.update(nextClock, this.#voiceLevel(), this.#sustainedDuration(), trigger, true)
    this.#state = advanceSoundCannon(this.#state, {
      deltaMs: safeDelta,
      fireEvents: cycle.fireEvent ? [cycle.fireEvent] : [],
      charge: cycle.charge,
      voiceMeterLevel: cycle.voiceMeterLevel,
      cannonState: cycle.cannonState,
    })
    this.#notify()
  }

  #voiceLevel(): number {
    const action = this.#provider.getSnapshot().players[0]?.actions.VOICE_LEVEL
    return Math.max(0, Math.min(1, numeric(action?.value)))
  }
  #sustainedDuration(): number {
    const action = this.#provider.getSnapshot().players[0]?.actions.VOICE_SUSTAINED_DURATION
    return Math.max(0, Math.min(SOUND_CANNON_RULES.maximumSustainedDurationSeconds, numeric(action?.value)))
  }
  #collectNewTrigger(): number | null {
    const action = this.#provider.getSnapshot().players[0]?.actions.VOICE_TRIGGER
    if (!action || action.sequence <= this.#lastSeenTriggerSequence) return null
    this.#lastSeenTriggerSequence = action.sequence
    return action.phase === 'started' || action.phase === 'active' ? action.sequence : null
  }
  #markCurrentTrigger(snapshot: MotionInputSnapshot): void { this.#lastSeenTriggerSequence = snapshot.players[0]?.actions.VOICE_TRIGGER?.sequence ?? 0 }
  #notify(): void { for (const listener of this.#listeners) listener() }
}
