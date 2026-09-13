import {
  actionAllowedForProfile,
  resolveAbilityProfile,
} from '../adaptive/profiles'
import {
  resolvePoseMotionConfig,
  type ResolvedPoseMotionConfig,
} from '../calibration/calibrationAdaptation'
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
import {
  POSE_MOTION_CONFIG,
  type PoseLowerBodyReadiness,
} from './poseMotionConfig'
import type { PoseMotionAnalyzerSnapshot } from './poseMotionTypes'

export interface PoseMotionInputProviderOptions {
  readonly now?: () => number
  readonly analyzer?: PoseMotionAnalyzer
  /** Opt-in per provider session; default preserves strict FULL_BODY readiness. */
  readonly lowerBodyReadiness?: PoseLowerBodyReadiness
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
  readonly #injectedAnalyzer: PoseMotionAnalyzer | undefined
  readonly #lowerBodyReadiness: PoseLowerBodyReadiness
  #analyzer: PoseMotionAnalyzer
  #effectiveConfig: ResolvedPoseMotionConfig
  readonly #listeners = new Set<() => void>()
  #request: MotionInputRequest | undefined
  #running = false
  #snapshotSequence = 0
  #lastAnalyzerSequence = -1
  #snapshot: MotionInputSnapshot

  constructor(options: PoseMotionInputProviderOptions = {}) {
    this.#now = options.now ?? (() => performance.now())
    this.#injectedAnalyzer = options.analyzer
    this.#lowerBodyReadiness = options.lowerBodyReadiness ?? 'STRICT'
    this.#effectiveConfig = resolvePoseMotionConfig(
      undefined,
      resolveAbilityProfile(['STANDARD']),
    )
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
    const requestedPlayer = request.players[0]
    const resolvedConfig = resolvePoseMotionConfig(
      requestedPlayer?.calibration,
      requestedPlayer?.abilityProfile ?? resolveAbilityProfile(['STANDARD']),
    )
    this.#effectiveConfig = this.#withLowerBodyReadiness(resolvedConfig)
    this.#analyzer =
      this.#effectiveConfig.config === POSE_MOTION_CONFIG && this.#injectedAnalyzer
        ? this.#injectedAnalyzer
        : new PoseMotionAnalyzer(this.#effectiveConfig.config)
    this.#analyzer.reset()
    this.#lastAnalyzerSequence = -1
    this.#refresh(true)
  }

  async stop(): Promise<void> {
    if (!this.#running) return
    this.#running = false
    this.#analyzer.reset()
    this.#effectiveConfig = resolvePoseMotionConfig(
      undefined,
      resolveAbilityProfile(['STANDARD']),
    )
    this.#analyzer = this.#injectedAnalyzer ?? new PoseMotionAnalyzer()
    if (this.#request) {
      this.#request = Object.freeze({
        ...this.#request,
        players: Object.freeze(
          this.#request.players.map(({ playerId, abilityProfile }) =>
            Object.freeze({ playerId, abilityProfile }),
          ),
        ),
      })
    }
    this.#lastAnalyzerSequence = -1
    this.#refresh(true)
    this.#request = undefined
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

  getEffectiveConfig(): ResolvedPoseMotionConfig {
    return this.#effectiveConfig
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
    return Object.freeze({
      playerId: requestedPlayer.playerId,
      abilityProfile: requestedPlayer.abilityProfile,
      actions: Object.freeze(actions),
    })
  }

  #withLowerBodyReadiness(
    resolved: ResolvedPoseMotionConfig,
  ): ResolvedPoseMotionConfig {
    if (this.#lowerBodyReadiness === resolved.config.lowerBodyReadiness) {
      return resolved
    }
    return Object.freeze({
      ...resolved,
      config: Object.freeze({
        ...resolved.config,
        lowerBodyReadiness: this.#lowerBodyReadiness,
      }),
    })
  }
}
