export type ReactionArenaSfxEvent =
  | 'SUCCESS'
  | 'PERFECT'
  | 'SPECIAL_EVENT_START'
  | 'SPEED_ZONE_START'
  | 'COUNTDOWN_TICK'
  | 'ROUND_FINISH'

export const REACTION_ARENA_AUDIO_ASSETS = Object.freeze({
  bgm: '/audio/reaction-arena/bgm.mp3',
  success: '/audio/reaction-arena/hit.mp3',
  combo: '/audio/reaction-arena/combo.mp3',
  eventStart: '/audio/reaction-arena/event-start.mp3',
  speedZone: '/audio/reaction-arena/party-rush.mp3',
  countdown: '/audio/reaction-arena/countdown.mp3',
  finish: '/audio/reaction-arena/finish.mp3',
  cheer: '/audio/reaction-arena/cheer.mp3',
})

const SFX: Readonly<Record<ReactionArenaSfxEvent, readonly string[]>> = Object.freeze({
  SUCCESS: [REACTION_ARENA_AUDIO_ASSETS.success],
  PERFECT: [REACTION_ARENA_AUDIO_ASSETS.combo],
  SPECIAL_EVENT_START: [REACTION_ARENA_AUDIO_ASSETS.eventStart],
  SPEED_ZONE_START: [REACTION_ARENA_AUDIO_ASSETS.speedZone],
  COUNTDOWN_TICK: [REACTION_ARENA_AUDIO_ASSETS.countdown],
  ROUND_FINISH: [REACTION_ARENA_AUDIO_ASSETS.finish, REACTION_ARENA_AUDIO_ASSETS.cheer],
})

const GAINS: Readonly<Record<ReactionArenaSfxEvent, readonly number[]>> = Object.freeze({
  SUCCESS: [0.58],
  PERFECT: [0.5],
  SPECIAL_EVENT_START: [0.55],
  SPEED_ZONE_START: [0.65],
  COUNTDOWN_TICK: [0.55],
  ROUND_FINISH: [0.62, 0.4],
})

interface AudioElementLike extends HTMLAudioElement {
  onended: (() => void) | null
}

export interface ReactionArenaAudioEnvironment {
  readonly createAudioElement?: () => AudioElementLike
}

/** Provisional local-MP3 audio layer for Reaction Arena v1. */
export class ReactionArenaAudio {
  readonly #environment: ReactionArenaAudioEnvironment
  readonly #voices = new Set<AudioElementLike>()
  #bgm: AudioElementLike | null = null
  #unlocked = false
  #finishPlayed = false

  constructor(environment: ReactionArenaAudioEnvironment = {}) {
    this.#environment = environment
  }

  async unlock(): Promise<void> {
    try {
      const audio = this.#createAudioElement()
      audio.muted = true
      audio.src = REACTION_ARENA_AUDIO_ASSETS.success
      this.#unlocked = true
      await audio.play().catch(() => undefined)
      audio.pause()
      audio.currentTime = 0
    } catch {
      this.#unlocked = false
    }
  }

  play(event: ReactionArenaSfxEvent): void {
    if (!this.#unlocked) return
    if (event === 'ROUND_FINISH' && this.#finishPlayed) return
    if (event === 'ROUND_FINISH') this.#finishPlayed = true
    for (const [index, source] of SFX[event].entries()) {
      this.#play(source, GAINS[event][index] ?? 0.5, index === 1 ? 280 : 0)
    }
  }

  startBgm(): void {
    if (!this.#unlocked) return
    try {
      const bgm = this.#bgm ?? this.#createAudioElement()
      this.#bgm = bgm
      bgm.src = REACTION_ARENA_AUDIO_ASSETS.bgm
      bgm.loop = true
      bgm.volume = 0.22
      bgm.currentTime = 0
      void bgm.play().catch(() => undefined)
    } catch {
      // Audio is optional and fail-silent.
    }
  }

  stopBgm(): void {
    const bgm = this.#bgm
    if (!bgm) return
    bgm.pause()
    bgm.currentTime = 0
  }

  resetRoundAudio(): void {
    this.#finishPlayed = false
    this.stopBgm()
  }

  dispose(): void {
    this.stopBgm()
    this.#bgm = null
    for (const voice of this.#voices) {
      voice.pause()
      voice.onended = null
    }
    this.#voices.clear()
    this.#unlocked = false
  }

  #createAudioElement(): AudioElementLike {
    if (this.#environment.createAudioElement) return this.#environment.createAudioElement()
    return new Audio() as AudioElementLike
  }

  #play(source: string, volume: number, delayMs: number): void {
    if (delayMs > 0) {
      window.setTimeout(() => this.#play(source, volume, 0), delayMs)
      return
    }
    try {
      if (this.#voices.size >= 12) {
        const oldest = this.#voices.values().next().value as AudioElementLike | undefined
        oldest?.pause()
        if (oldest) this.#voices.delete(oldest)
      }
      const voice = this.#createAudioElement()
      voice.src = source
      voice.volume = volume
      voice.onended = () => this.#voices.delete(voice)
      this.#voices.add(voice)
      void voice.play().catch(() => this.#voices.delete(voice))
    } catch {
      // An unavailable asset must never affect gameplay.
    }
  }
}

export function getReactionArenaAudioSources(event: ReactionArenaSfxEvent): readonly string[] {
  return SFX[event]
}
