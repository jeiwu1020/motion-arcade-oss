import { actionAllowedForProfile } from '../adaptive/profiles'
import type {
  MotionActionId,
  MotionActionState,
  MotionInputProvider,
  MotionInputRequest,
  MotionInputSnapshot,
  PlayerMotionState,
} from '../contracts/motion'
import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { PoseMotionAnalyzer } from './PoseMotionAnalyzer'
import type { PoseMotionAnalyzerSnapshot } from './poseMotionTypes'

export interface PoseMotionInputProviderOptions {
  readonly now?: () => number
  readonly analyzer?: PoseMotionAnalyzer
}

function frozenIdleAction(
  actionId: MotionActionId,
  timestampMs: number,
  sequence: number,
): MotionActionState {
  return Object.freeze({
    id: actionId,
    value: 0,
    phase: 'idle',
    confidence: 0,
    timestampMs,
    sequence,
  })
}

export class PoseMotionInputProvider implements MotionInputProvider {
  readonly id = 'POSE' as const

  readonly #now: () => number
  readonly #analyzer: PoseMotionAnalyzer
  readonly #listeners = new Set<() => void>()
  #request: MotionInputRequest | undefined
  #running = false
  #snapshotSequence = 0
  #lastAnalyzerSequence = -1
  #snapshot: MotionInputSnapshot

  constructor(options: PoseMotionInputProviderOptions = {}) {
    this.#now = options.now ?? (() => performance.now())
    this.#analyzer = options.analyzer ?? new PoseMotionAnalyzer()
    this.#snapshot = Object.freeze({
      providerId: this.id,
      sequence: 0,
      timestampMs: this.#now(),
      players: Object.freeze([]),
    })
  }

  async start(request: MotionInputRequest): Promise<void> {
    this.#request = request
    this.#running = true
    this.#analyzer.reset()
    this.#lastAnalyzerSequence = -1
    this.#refresh(true)
  }

  async stop(): Promise<void> {
    if (!this.#running) return
    this.#running = false
    this.#analyzer.reset()
    this.#lastAnalyzerSequence = -1
    this.#refresh(true)
  }

  update(_deltaMs: number): void {
    if (this.#running) this.#refresh()
  }

  ingest(frame: PoseSensorFrame): void {
    if (!this.#running) return
    this.#analyzer.ingest(frame)
    this.#refresh()
  }

  getSnapshot(): MotionInputSnapshot {
    this.#refresh()
    return this.#snapshot
  }

  getDiagnostics(): PoseMotionAnalyzerSnapshot {
    return this.#analyzer.getSnapshot(this.#now())
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  isRunning(): boolean {
    return this.#running
  }

  #refresh(force = false): void {
    const timestampMs = this.#now()
    const analyzerSnapshot = this.#analyzer.getSnapshot(timestampMs)
    if (!force && analyzerSnapshot.sequence === this.#lastAnalyzerSequence) {
      return
    }
    this.#lastAnalyzerSequence = analyzerSnapshot.sequence
    const requestedPlayer = this.#request?.players[0]
    const players: readonly PlayerMotionState[] = requestedPlayer
      ? Object.freeze([
          this.#createPlayerState(requestedPlayer, analyzerSnapshot),
        ])
      : Object.freeze([])
    this.#snapshot = Object.freeze({
      providerId: this.id,
      sequence: ++this.#snapshotSequence,
      timestampMs,
      players,
    })
    this.#listeners.forEach((listener) => listener())
  }

  #createPlayerState(
    requestedPlayer: MotionInputRequest['players'][number],
    analyzerSnapshot: PoseMotionAnalyzerSnapshot,
  ): PlayerMotionState {
    const actions: Partial<Record<MotionActionId, MotionActionState>> = {}
    for (const actionId of this.#request?.actions ?? []) {
      const analyzed = analyzerSnapshot.actions[actionId]
      actions[actionId] =
        analyzed &&
        this.#running &&
        analyzerSnapshot.baselineReady &&
        analyzerSnapshot.quality !== 'LOST' &&
        actionAllowedForProfile(actionId, requestedPlayer.abilityProfile)
          ? analyzed
          : frozenIdleAction(
              actionId,
              analyzerSnapshot.timestampMs,
              analyzed?.sequence ?? 0,
            )
    }
    const state = {
      playerId: requestedPlayer.playerId,
      abilityProfile: requestedPlayer.abilityProfile,
      actions: Object.freeze(actions),
    }
    return Object.freeze(
      requestedPlayer.calibration
        ? { ...state, calibration: requestedPlayer.calibration }
        : state,
    )
  }
}
