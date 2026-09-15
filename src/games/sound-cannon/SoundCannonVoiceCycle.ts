import {
  soundCannonCharge,
  soundCannonComfortLevel,
  SOUND_CANNON_RULES,
  type SoundCannonFireEvent,
} from './SoundCannonCore'

export type SoundCannonVoiceCycleState = 'ARMED' | 'CHARGING' | 'WAITING_FOR_QUIET'

export interface SoundCannonVoiceCycleSnapshot {
  readonly cannonState: SoundCannonVoiceCycleState
  readonly comfortLevel: number
  readonly voiceMeterLevel: number
  readonly sustainedDurationSeconds: number
  readonly charge: number
  readonly fireEvent: SoundCannonFireEvent | null
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) }
function safeNumber(value: number): number { return Number.isFinite(value) ? value : 0 }

/** Game-local voice cycle; browser microphone ownership remains in F0. */
export class SoundCannonVoiceCycle {
  #state: SoundCannonVoiceCycleState = 'ARMED'
  #chargeStartMs = 0
  #comfortLevel = 0
  #voiceMeterLevel = 0
  #sustainedDurationSeconds = 0
  #charge = 0
  #lastTriggerSequence = 0
  #fireSequence = 0

  getSnapshot(): SoundCannonVoiceCycleSnapshot {
    return Object.freeze({ cannonState: this.#state, comfortLevel: this.#comfortLevel, voiceMeterLevel: this.#voiceMeterLevel, sustainedDurationSeconds: this.#sustainedDurationSeconds, charge: this.#charge, fireEvent: null })
  }

  reset(): void {
    this.#state = 'ARMED'
    this.#chargeStartMs = 0
    this.#comfortLevel = 0
    this.#voiceMeterLevel = 0
    this.#sustainedDurationSeconds = 0
    this.#charge = 0
    this.#lastTriggerSequence = 0
  }

  markTriggerSequence(sequence: number): void { this.#lastTriggerSequence = Math.max(this.#lastTriggerSequence, Math.trunc(safeNumber(sequence))) }

  start(nowMs: number, triggerSequence: number): void {
    this.#state = 'CHARGING'
    this.#chargeStartMs = Math.max(0, safeNumber(nowMs))
    this.#lastTriggerSequence = Math.max(this.#lastTriggerSequence, Math.trunc(safeNumber(triggerSequence)))
    this.#charge = 0
  }

  update(
    nowMs: number,
    voiceLevel: number,
    sustainedDurationSeconds: number,
    triggerSequence: number | null,
    allowStart: boolean,
  ): SoundCannonVoiceCycleSnapshot {
    const now = Math.max(0, safeNumber(nowMs))
    const level = clamp01(voiceLevel)
    const sustained = Math.max(0, Math.min(SOUND_CANNON_RULES.maximumSustainedDurationSeconds, safeNumber(sustainedDurationSeconds)))
    const comfort = soundCannonComfortLevel(level)
    let fireEvent: SoundCannonFireEvent | null = null

    this.#voiceMeterLevel = comfort
    this.#comfortLevel = comfort
    this.#sustainedDurationSeconds = sustained

    const wasWaitingForQuiet = this.#state === 'WAITING_FOR_QUIET'
    if (wasWaitingForQuiet && level <= 0.12 && sustained <= 0) {
      this.#state = 'ARMED'
      this.#charge = 0
    }

    const isNewTrigger = triggerSequence !== null && triggerSequence > this.#lastTriggerSequence
    if (isNewTrigger) {
      this.#lastTriggerSequence = triggerSequence
      if (allowStart && this.#state === 'ARMED' && !wasWaitingForQuiet) this.start(now, triggerSequence)
    }

    if (this.#state === 'CHARGING') {
      this.#charge = soundCannonCharge(comfort, sustained)
      if (level <= 0.12 || now - this.#chargeStartMs >= SOUND_CANNON_RULES.maximumChargeVoiceMs) {
        this.#fireSequence += 1
        fireEvent = Object.freeze({ timestampMs: Math.min(now, this.#chargeStartMs + SOUND_CANNON_RULES.maximumChargeVoiceMs), blastPower: this.#charge, fullBlast: this.#charge >= SOUND_CANNON_RULES.fullBlastThreshold, sequence: this.#fireSequence })
        this.#state = 'WAITING_FOR_QUIET'
      }
    }

    return Object.freeze({ cannonState: this.#state, comfortLevel: this.#comfortLevel, voiceMeterLevel: this.#voiceMeterLevel, sustainedDurationSeconds: this.#sustainedDurationSeconds, charge: this.#charge, fireEvent })
  }
}
