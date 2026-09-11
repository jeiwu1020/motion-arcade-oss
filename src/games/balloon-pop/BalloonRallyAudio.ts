export type BalloonRallySfxEvent =
  | 'NORMAL_HIT'
  | 'NORMAL_POP'
  | 'GOLDEN_POP'
  | 'GIANT_HIT'
  | 'GIANT_POP'
  | 'COMBO_MILESTONE'
  | 'COMBO_MILESTONE_STRONG'
  | 'MINI_EVENT_START'
  | 'PARTY_RUSH_START'
  | 'COUNTDOWN_TICK'
  | 'ROUND_FINISH'

export const BALLOON_RALLY_AUDIO_ASSETS = Object.freeze({
  bgm: '/audio/balloon-rally/bgm.mp3',
  hit: '/audio/balloon-rally/hit.mp3',
  pop: '/audio/balloon-rally/pop.mp3',
  goldenSparkle: '/audio/balloon-rally/golden-sparkle.mp3',
  giantHit: '/audio/balloon-rally/giant-hit.mp3',
  combo: '/audio/balloon-rally/combo.mp3',
  eventStart: '/audio/balloon-rally/event-start.mp3',
  partyRush: '/audio/balloon-rally/party-rush.mp3',
  countdown: '/audio/balloon-rally/countdown.mp3',
  finish: '/audio/balloon-rally/finish.mp3',
  cheer: '/audio/balloon-rally/cheer.mp3',
})

export const BALLOON_RALLY_AUDIO_CONFIG = Object.freeze({
  maxSfxVoices: 24,
  normalBgmGain: 0.22,
  partyRushBgmGain: 0.28,
  bgmFadeMs: 420,
})

const SFX_SOURCES: Readonly<Record<BalloonRallySfxEvent, readonly string[]>> = Object.freeze({
  NORMAL_HIT: [BALLOON_RALLY_AUDIO_ASSETS.hit],
  NORMAL_POP: [BALLOON_RALLY_AUDIO_ASSETS.pop],
  GOLDEN_POP: [BALLOON_RALLY_AUDIO_ASSETS.pop, BALLOON_RALLY_AUDIO_ASSETS.goldenSparkle],
  GIANT_HIT: [BALLOON_RALLY_AUDIO_ASSETS.giantHit],
  GIANT_POP: [BALLOON_RALLY_AUDIO_ASSETS.pop, BALLOON_RALLY_AUDIO_ASSETS.giantHit],
  COMBO_MILESTONE: [BALLOON_RALLY_AUDIO_ASSETS.combo],
  COMBO_MILESTONE_STRONG: [BALLOON_RALLY_AUDIO_ASSETS.combo],
  MINI_EVENT_START: [BALLOON_RALLY_AUDIO_ASSETS.eventStart],
  PARTY_RUSH_START: [BALLOON_RALLY_AUDIO_ASSETS.partyRush],
  COUNTDOWN_TICK: [BALLOON_RALLY_AUDIO_ASSETS.countdown],
  ROUND_FINISH: [BALLOON_RALLY_AUDIO_ASSETS.finish, BALLOON_RALLY_AUDIO_ASSETS.cheer],
})

const SFX_GAINS: Readonly<Record<BalloonRallySfxEvent, readonly number[]>> = Object.freeze({
  NORMAL_HIT: [0.66],
  NORMAL_POP: [0.82],
  GOLDEN_POP: [0.8, 0.46],
  GIANT_HIT: [0.66],
  GIANT_POP: [0.8, 0.56],
  COMBO_MILESTONE: [0.55],
  COMBO_MILESTONE_STRONG: [0.6],
  MINI_EVENT_START: [0.6],
  PARTY_RUSH_START: [0.72],
  COUNTDOWN_TICK: [0.6],
  ROUND_FINISH: [0.68, 0.43],
})

export function getBalloonRallyAudioSources(event: BalloonRallySfxEvent): readonly string[] {
  return SFX_SOURCES[event]
}

interface BalloonRallyAudioEnvironment {
  readonly audioContextFactory?: () => AudioContext
  readonly createAudioElement?: () => HTMLAudioElement
  readonly fetchAsset?: typeof fetch
}

type AudioContextConstructor = new () => AudioContext

/** Local MP3 SFX/BGM playback. It is gesture-unlocked and always fail-silent. */
export class BalloonRallyAudio {
  #context: AudioContext | null = null
  #unlocked = false
  #sfxBuffers = new Map<string, AudioBuffer>()
  #sfxLoadPromise: Promise<void> | null = null
  #voices = new Set<AudioBufferSourceNode>()
  #bgm: HTMLAudioElement | null = null
  #bgmFadeFrame: number | null = null
  #pendingTimers = new Set<ReturnType<typeof setTimeout>>()
  readonly #environment: BalloonRallyAudioEnvironment

  constructor(environment: BalloonRallyAudioEnvironment = {}) {
    this.#environment = environment
  }

  async unlock(): Promise<void> {
    if (this.#unlocked && this.#context) return
    try {
      const context = this.#context ?? this.#createContext()
      if (!context) return
      this.#context = context
      if (context.state === 'suspended') await context.resume()
      this.#unlocked = context.state === 'running'
      if (this.#unlocked) void this.#loadSfxBuffers()
    } catch {
      this.#unlocked = false
      this.#context = null
    }
  }

  play(event: BalloonRallySfxEvent): void {
    if (!this.#unlocked || !this.#context) return
    const sources = SFX_SOURCES[event]
    const gains = SFX_GAINS[event]
    if (event === 'ROUND_FINISH') {
      this.#playBuffer(sources[0] ?? BALLOON_RALLY_AUDIO_ASSETS.finish, gains[0] ?? 0.68)
      this.#scheduleDelayedBuffer(sources[1] ?? BALLOON_RALLY_AUDIO_ASSETS.cheer, gains[1] ?? 0.43, 300)
      return
    }
    sources.forEach((source, index) => this.#playBuffer(source, gains[index] ?? 0.6))
  }

  /** Start or restart the single streaming BGM element at the active-round boundary. */
  startBgm(): void {
    if (!this.#unlocked) return
    try {
      const bgm = this.#getBgm()
      this.#cancelBgmFade()
      bgm.pause()
      bgm.currentTime = 0
      bgm.loop = true
      bgm.volume = BALLOON_RALLY_AUDIO_CONFIG.normalBgmGain
      void bgm.play().catch(() => undefined)
    } catch {
      // BGM is optional and must never block the round.
    }
  }

  setPartyRush(): void {
    this.#fadeBgmTo(BALLOON_RALLY_AUDIO_CONFIG.partyRushBgmGain)
  }

  stopBgm(immediate = false): void {
    const bgm = this.#bgm
    if (!bgm) return
    if (immediate) {
      this.#cancelBgmFade()
      bgm.pause()
      bgm.currentTime = 0
      bgm.volume = BALLOON_RALLY_AUDIO_CONFIG.normalBgmGain
      return
    }
    this.#fadeBgmTo(0, () => {
      bgm.pause()
      bgm.currentTime = 0
      bgm.volume = BALLOON_RALLY_AUDIO_CONFIG.normalBgmGain
    })
  }

  getActiveVoiceCount(): number {
    return this.#voices.size
  }

  getHasBgmInstance(): boolean {
    return this.#bgm !== null
  }

  /** Cancels delayed one-shot effects when a round is replayed or abandoned. */
  resetRoundAudio(): void {
    this.#cancelPendingTimers()
  }

  async dispose(): Promise<void> {
    this.#cancelPendingTimers()
    this.stopBgm(true)
    this.#bgm = null
    for (const voice of this.#voices) {
      try { voice.stop() } catch { /* already ended */ }
    }
    this.#voices.clear()
    const context = this.#context
    this.#context = null
    this.#unlocked = false
    this.#sfxBuffers.clear()
    this.#sfxLoadPromise = null
    if (context) {
      try { await context.close() } catch { /* optional cleanup */ }
    }
  }

  #createContext(): AudioContext | null {
    if (this.#environment.audioContextFactory) return this.#environment.audioContextFactory()
    const scope = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextConstructor }
    const Constructor = (scope.AudioContext as AudioContextConstructor | undefined) ?? scope.webkitAudioContext
    return Constructor ? new Constructor() : null
  }

  #getBgm(): HTMLAudioElement {
    if (this.#bgm) return this.#bgm
    const bgm = this.#environment.createAudioElement
      ? this.#environment.createAudioElement()
      : document.createElement('audio')
    bgm.src = BALLOON_RALLY_AUDIO_ASSETS.bgm
    bgm.preload = 'auto'
    bgm.setAttribute('aria-hidden', 'true')
    this.#bgm = bgm
    return bgm
  }

  async #loadSfxBuffers(): Promise<void> {
    if (this.#sfxLoadPromise) return this.#sfxLoadPromise
    const context = this.#context
    const fetchAsset = this.#environment.fetchAsset ?? globalThis.fetch?.bind(globalThis)
    if (!context || !fetchAsset) return
    const urls = [...new Set(Object.values(SFX_SOURCES).flat())]
    this.#sfxLoadPromise = Promise.all(urls.map(async (url) => {
      try {
        const response = await fetchAsset(url)
        if (!response.ok) return
        const buffer = await context.decodeAudioData(await response.arrayBuffer())
        if (this.#context === context) this.#sfxBuffers.set(url, buffer)
      } catch {
        // Individual missing/corrupt assets remain fail-silent.
      }
    })).then(() => undefined)
    await this.#sfxLoadPromise
  }

  #playBuffer(url: string, gainValue: number): void {
    const context = this.#context
    const buffer = this.#sfxBuffers.get(url)
    if (!context || !buffer || this.#voices.size >= BALLOON_RALLY_AUDIO_CONFIG.maxSfxVoices) return
    try {
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = buffer
      gain.gain.value = gainValue
      source.connect(gain).connect(context.destination)
      this.#voices.add(source)
      source.addEventListener('ended', () => this.#voices.delete(source), { once: true })
      source.start()
    } catch {
      // A browser audio implementation can fail transiently after suspension.
    }
  }

  #scheduleDelayedBuffer(url: string, gainValue: number, delayMs: number): void {
    const timer = setTimeout(() => {
      this.#pendingTimers.delete(timer)
      this.#playBuffer(url, gainValue)
    }, delayMs)
    this.#pendingTimers.add(timer)
  }

  #cancelPendingTimers(): void {
    for (const timer of this.#pendingTimers) clearTimeout(timer)
    this.#pendingTimers.clear()
  }

  #fadeBgmTo(target: number, onComplete?: () => void): void {
    const bgm = this.#bgm
    if (!bgm) return
    this.#cancelBgmFade()
    if (typeof requestAnimationFrame !== 'function') {
      bgm.volume = target
      onComplete?.()
      return
    }
    const start = performance.now()
    const initial = bgm.volume
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / BALLOON_RALLY_AUDIO_CONFIG.bgmFadeMs)
      bgm.volume = initial + (target - initial) * progress
      if (progress >= 1) {
        this.#bgmFadeFrame = null
        onComplete?.()
        return
      }
      this.#bgmFadeFrame = requestAnimationFrame(step)
    }
    this.#bgmFadeFrame = requestAnimationFrame(step)
  }

  #cancelBgmFade(): void {
    if (this.#bgmFadeFrame === null || typeof cancelAnimationFrame !== 'function') return
    cancelAnimationFrame(this.#bgmFadeFrame)
    this.#bgmFadeFrame = null
  }
}
