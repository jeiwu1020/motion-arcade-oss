export interface VoiceSignalConfig {
  readonly noiseFloorDb: number
  readonly fullLevelDb: number
  readonly smoothingAlpha: number
  readonly triggerEnterLevel: number
  readonly triggerExitLevel: number
  readonly minimumTriggerSamples: number
  readonly sustainEnterLevel: number
  readonly sustainExitLevel: number
  readonly maximumSustainedDurationSeconds: number
  readonly rmsEpsilon: number
}

export const VOICE_SIGNAL_CONFIG: VoiceSignalConfig = Object.freeze({
  noiseFloorDb: -60,
  fullLevelDb: -12,
  smoothingAlpha: 0.35,
  triggerEnterLevel: 0.22,
  triggerExitLevel: 0.12,
  minimumTriggerSamples: 2,
  sustainEnterLevel: 0.18,
  sustainExitLevel: 0.12,
  maximumSustainedDurationSeconds: 4,
  rmsEpsilon: 1e-8,
})

export interface VoiceSignalAnalysis {
  readonly level: number
  readonly rawLevel: number
  readonly triggered: boolean
  readonly sustainedDurationSeconds: number
}

type TriggerState = 'IDLE' | 'CANDIDATE' | 'LATCHED'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function boundedDeltaSeconds(deltaMs: number): number {
  return Math.max(0, Number.isFinite(deltaMs) ? deltaMs / 1_000 : 0)
}

function rmsFor(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sumSquares = 0
  for (const sample of samples) {
    const validSample = Number.isFinite(sample) ? sample : 0
    sumSquares += validSample * validSample
  }
  return Math.sqrt(sumSquares / samples.length)
}

/**
 * Transient microphone waveform analysis. It produces no browser or audio
 * objects and has no game-facing snapshot contract of its own.
 */
export class VoiceSignalAnalyzer {
  readonly #config: VoiceSignalConfig
  #level = 0
  #triggerState: TriggerState = 'IDLE'
  #triggerSamples = 0
  #sustainActive = false
  #sustainedDurationSeconds = 0

  constructor(config: Partial<VoiceSignalConfig> = {}) {
    this.#config = Object.freeze({ ...VOICE_SIGNAL_CONFIG, ...config })
  }

  update(samples: Float32Array, deltaMs: number): VoiceSignalAnalysis {
    const rms = rmsFor(samples)
    const db = 20 * Math.log10(Math.max(rms, this.#config.rmsEpsilon))
    const rawLevel = clamp01(
      (db - this.#config.noiseFloorDb) /
        (this.#config.fullLevelDb - this.#config.noiseFloorDb),
    )
    this.#level = clamp01(
      this.#level + (rawLevel - this.#level) * this.#config.smoothingAlpha,
    )

    const triggered = this.#advanceTrigger(this.#level)
    this.#advanceSustainedDuration(this.#level, boundedDeltaSeconds(deltaMs))

    return Object.freeze({
      level: this.#level,
      rawLevel,
      triggered,
      sustainedDurationSeconds: this.#sustainedDurationSeconds,
    })
  }

  reset(): void {
    this.#level = 0
    this.#triggerState = 'IDLE'
    this.#triggerSamples = 0
    this.#sustainActive = false
    this.#sustainedDurationSeconds = 0
  }

  #advanceTrigger(level: number): boolean {
    if (this.#triggerState === 'LATCHED') {
      if (level <= this.#config.triggerExitLevel) {
        this.#triggerState = 'IDLE'
        this.#triggerSamples = 0
      }
      return false
    }

    if (level < this.#config.triggerEnterLevel) {
      this.#triggerState = 'IDLE'
      this.#triggerSamples = 0
      return false
    }

    this.#triggerState = 'CANDIDATE'
    this.#triggerSamples += 1
    if (this.#triggerSamples < this.#config.minimumTriggerSamples) return false

    this.#triggerState = 'LATCHED'
    this.#triggerSamples = 0
    return true
  }

  #advanceSustainedDuration(level: number, deltaSeconds: number): void {
    if (!this.#sustainActive && level >= this.#config.sustainEnterLevel) {
      this.#sustainActive = true
    } else if (this.#sustainActive && level <= this.#config.sustainExitLevel) {
      this.#sustainActive = false
      this.#sustainedDurationSeconds = 0
      return
    }

    if (!this.#sustainActive) {
      this.#sustainedDurationSeconds = 0
      return
    }

    this.#sustainedDurationSeconds = Math.min(
      this.#config.maximumSustainedDurationSeconds,
      this.#sustainedDurationSeconds + deltaSeconds,
    )
  }
}
