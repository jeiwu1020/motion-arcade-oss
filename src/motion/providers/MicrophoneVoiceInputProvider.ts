import { actionAllowedForProfile } from '../adaptive/profiles'
import type {
  MotionActionId,
  MotionActionPhase,
  MotionActionState,
  MotionInputProvider,
  MotionInputRequest,
  MotionInputSnapshot,
  MotionPlayerRequest,
  PlayerMotionState,
} from '../contracts/motion'
import { VoiceSignalAnalyzer } from '../voice/VoiceSignalAnalyzer'
import {
  MicrophoneAudioSource,
  type VoiceAudioSource,
} from '../../sensors/audio/MicrophoneAudioSource'

const SUPPORTED_ACTIONS = new Set<MotionActionId>([
  'VOICE_LEVEL',
  'VOICE_TRIGGER',
  'VOICE_SUSTAINED_DURATION',
])

export interface MicrophoneVoiceInputProviderOptions {
  readonly source?: VoiceAudioSource
  readonly analyzer?: VoiceSignalAnalyzer
  readonly now?: () => number
}

function emptySnapshot(timestampMs: number): MotionInputSnapshot {
  return Object.freeze({
    providerId: 'MICROPHONE_VOICE',
    sequence: 0,
    timestampMs,
    players: Object.freeze([]),
  })
}

function numericValue(action: MotionActionState | undefined): number {
  return typeof action?.value === 'number' ? action.value : 0
}

function phaseForContinuous(
  previous: MotionActionState | undefined,
  value: number,
): MotionActionPhase {
  const previousValue = numericValue(previous)
  if (value === 0) return previousValue > 0 ? 'ended' : 'idle'
  return previousValue === 0 ? 'started' : 'active'
}

/**
 * Production microphone provider. Its only public output is the existing
 * MotionInputSnapshot voice actions; browser audio objects remain private.
 */
export class MicrophoneVoiceInputProvider implements MotionInputProvider {
  readonly id = 'MICROPHONE_VOICE' as const

  readonly #source: VoiceAudioSource
  readonly #analyzer: VoiceSignalAnalyzer
  readonly #now: () => number
  readonly #listeners = new Set<() => void>()
  readonly #unsubscribeSourceStopped: () => void
  #request: MotionInputRequest | undefined
  #running = false
  #disposed = false
  #snapshotSequence = 0
  #actionSequence = 0
  #snapshot: MotionInputSnapshot

  constructor(options: MicrophoneVoiceInputProviderOptions = {}) {
    this.#source = options.source ?? new MicrophoneAudioSource()
    this.#analyzer = options.analyzer ?? new VoiceSignalAnalyzer()
    this.#now = options.now ?? (() => performance.now())
    this.#snapshot = emptySnapshot(this.#now())
    this.#unsubscribeSourceStopped = this.#source.subscribeStopped(
      this.#handleSourceStopped,
    )
  }

  async start(request: MotionInputRequest): Promise<void> {
    if (this.#disposed) throw new Error('Microphone voice provider is disposed.')
    this.#validateRequest(request)
    if (this.#running) await this.stop()
    try {
      await this.#source.start()
      this.#analyzer.reset()
      this.#request = request
      this.#running = true
      this.#publishIdleSnapshot()
    } catch (error) {
      this.#running = false
      this.#request = undefined
      this.#analyzer.reset()
      this.#snapshot = emptySnapshot(this.#now())
      throw error
    }
  }

  async stop(): Promise<void> {
    this.#running = false
    await this.#source.stop()
    this.#analyzer.reset()
    this.#publishIdleSnapshot()
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    this.#unsubscribeSourceStopped()
    this.#running = false
    await this.#source.dispose()
    this.#analyzer.reset()
    this.#publishIdleSnapshot()
    this.#listeners.clear()
  }

  update(deltaMs: number): void {
    if (!this.#running) return
    if (!this.#source.isRunning()) {
      this.#handleSourceStopped()
      return
    }
    const samples = this.#source.readTimeDomainSamples()
    if (!samples) return
    const analysis = this.#analyzer.update(samples, deltaMs)
    this.#publishAnalysis(analysis)
  }

  getSnapshot(): MotionInputSnapshot {
    return this.#snapshot
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  isRunning(): boolean {
    return this.#running
  }

  #validateRequest(request: MotionInputRequest): void {
    if (request.players.length !== 1) {
      throw new Error('Microphone voice input supports one player only.')
    }
    if (!request.sensors.audio) {
      throw new Error('Microphone voice input requires sensors.audio=true.')
    }
    if (request.sensors.pose || request.sensors.hands) {
      throw new Error('Microphone voice input does not support mixed Pose or Hands requests.')
    }
    for (const actionId of request.actions) {
      if (actionId === 'VOICE_PITCH') {
        throw new Error('VOICE_PITCH production input is deferred pending physical validation.')
      }
      if (!SUPPORTED_ACTIONS.has(actionId)) {
        throw new Error(`Unsupported VOICE action for microphone input: ${actionId}.`)
      }
    }
  }

  #publishAnalysis(analysis: ReturnType<VoiceSignalAnalyzer['update']>): void {
    const player = this.#request?.players[0]
    if (!player) return
    const previous = this.#snapshot.players[0]?.actions ?? {}
    const actions: Partial<Record<MotionActionId, MotionActionState>> = {}
    for (const actionId of this.#request?.actions ?? []) {
      if (!actionAllowedForProfile(actionId, player.abilityProfile)) continue
      const prior = previous[actionId]
      if (actionId === 'VOICE_LEVEL') {
        actions[actionId] = this.#nextAction(
          actionId,
          prior,
          analysis.level,
          phaseForContinuous(prior, analysis.level),
        )
      } else if (actionId === 'VOICE_SUSTAINED_DURATION') {
        actions[actionId] = this.#nextAction(
          actionId,
          prior,
          analysis.sustainedDurationSeconds,
          phaseForContinuous(prior, analysis.sustainedDurationSeconds),
        )
      } else {
        actions[actionId] = analysis.triggered
          ? this.#nextAction(actionId, prior, 1, 'started', true)
          : this.#nextAction(
              actionId,
              prior,
              0,
              prior?.phase === 'started' ? 'ended' : 'idle',
              false,
              false,
            )
      }
    }
    this.#publishPlayerSnapshot(player, actions)
  }

  #publishIdleSnapshot(): void {
    const request = this.#request
    const player = request?.players[0]
    if (!player) {
      this.#snapshot = emptySnapshot(this.#now())
      return
    }
    const priorActions = this.#snapshot.players[0]?.actions ?? {}
    const actions: Partial<Record<MotionActionId, MotionActionState>> = {}
    for (const actionId of request.actions) {
      actions[actionId] = this.#nextAction(
        actionId,
        priorActions[actionId],
        0,
        'idle',
        true,
      )
    }
    this.#publishPlayerSnapshot(player, actions)
  }

  #publishPlayerSnapshot(
    player: MotionPlayerRequest,
    actions: Partial<Record<MotionActionId, MotionActionState>>,
  ): void {
    const playerState: PlayerMotionState = Object.freeze({
      playerId: player.playerId,
      abilityProfile: player.abilityProfile,
      actions: Object.freeze({ ...actions }),
    })
    this.#snapshot = Object.freeze({
      providerId: this.id,
      sequence: ++this.#snapshotSequence,
      timestampMs: this.#now(),
      players: Object.freeze([playerState]),
    })
    for (const listener of this.#listeners) listener()
  }

  #nextAction(
    id: MotionActionId,
    previous: MotionActionState | undefined,
    value: number,
    phase: MotionActionPhase,
    forceSequence = false,
    incrementSequence = true,
  ): MotionActionState {
    if (
      !forceSequence &&
      previous &&
      previous.value === value &&
      previous.phase === phase
    ) {
      return previous
    }
    return Object.freeze({
      id,
      value,
      phase,
      confidence: 1,
      timestampMs: this.#now(),
      sequence:
        forceSequence || incrementSequence || !previous
          ? ++this.#actionSequence
          : previous.sequence,
    })
  }

  readonly #handleSourceStopped = (): void => {
    if (!this.#running && !this.#request) return
    this.#running = false
    this.#analyzer.reset()
    this.#publishIdleSnapshot()
  }
}
