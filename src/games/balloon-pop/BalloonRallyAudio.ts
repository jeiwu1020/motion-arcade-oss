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

type AudioContextConstructor = new () => AudioContext

const MAX_ACTIVE_VOICES = 24

/** Small, gesture-unlocked, game-local SFX helper. Failure is always fail-silent. */
export class BalloonRallyAudio {
  #context: AudioContext | null = null
  #unlocked = false
  readonly #voices = new Set<OscillatorNode>()

  async unlock(): Promise<void> {
    if (this.#unlocked && this.#context) return
    try {
      const scope = globalThis as typeof globalThis & {
        webkitAudioContext?: AudioContextConstructor
      }
      const Constructor = (scope.AudioContext as AudioContextConstructor | undefined) ?? scope.webkitAudioContext
      if (!Constructor) return
      this.#context ??= new Constructor()
      if (this.#context.state === 'suspended') await this.#context.resume()
      this.#unlocked = this.#context.state === 'running'
    } catch {
      this.#unlocked = false
      this.#context = null
    }
  }

  play(event: BalloonRallySfxEvent): void {
    const context = this.#context
    if (!this.#unlocked || !context || context.state !== 'running' || this.#voices.size >= MAX_ACTIVE_VOICES) return
    try {
      switch (event) {
        case 'NORMAL_HIT': this.#tone(190, 0.1, 'sine', 0.045); break
        case 'NORMAL_POP': this.#tone(360, 0.18, 'triangle', 0.06); break
        case 'GOLDEN_POP': this.#tone(760, 0.22, 'sine', 0.065, 1.35); break
        case 'GIANT_HIT': this.#tone(110, 0.14, 'triangle', 0.07); break
        case 'GIANT_POP':
          this.#tone(105, 0.28, 'triangle', 0.08)
          this.#tone(680, 0.26, 'sine', 0.06, 1.25, 0.02)
          break
        case 'COMBO_MILESTONE':
          this.#tone(520, 0.14, 'sine', 0.055, 1.35)
          this.#tone(780, 0.18, 'sine', 0.05, 1.35, 0.07)
          break
        case 'COMBO_MILESTONE_STRONG':
          this.#tone(520, 0.16, 'triangle', 0.07, 1.4)
          this.#tone(780, 0.2, 'triangle', 0.065, 1.4, 0.07)
          this.#tone(1_040, 0.24, 'sine', 0.06, 1.4, 0.14)
          break
        case 'MINI_EVENT_START':
          this.#tone(420, 0.16, 'triangle', 0.055, 1.2)
          this.#tone(630, 0.2, 'triangle', 0.05, 1.2, 0.07)
          break
        case 'PARTY_RUSH_START':
          this.#tone(260, 0.16, 'sawtooth', 0.045, 1.15)
          this.#tone(520, 0.18, 'triangle', 0.055, 1.2, 0.07)
          this.#tone(820, 0.24, 'sine', 0.06, 1.2, 0.14)
          break
        case 'COUNTDOWN_TICK': this.#tone(440, 0.09, 'sine', 0.045); break
        case 'ROUND_FINISH':
          this.#tone(520, 0.18, 'sine', 0.05)
          this.#tone(780, 0.22, 'sine', 0.055, 1.25, 0.08)
          this.#tone(1_040, 0.28, 'sine', 0.06, 1.25, 0.16)
          break
      }
    } catch {
      // Sound is optional; never let an audio API failure affect gameplay.
    }
  }

  async dispose(): Promise<void> {
    for (const voice of this.#voices) {
      try { voice.stop() } catch { /* already ended */ }
    }
    this.#voices.clear()
    const context = this.#context
    this.#context = null
    this.#unlocked = false
    if (context) {
      try { await context.close() } catch { /* optional cleanup */ }
    }
  }

  #tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    frequencyMultiplier = 1,
    offsetSeconds = 0,
  ): void {
    const context = this.#context
    if (!context || this.#voices.size >= MAX_ACTIVE_VOICES) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime + offsetSeconds
    const end = start + duration
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * frequencyMultiplier), end)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.2))
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    oscillator.connect(gain).connect(context.destination)
    this.#voices.add(oscillator)
    oscillator.addEventListener('ended', () => this.#voices.delete(oscillator), { once: true })
    oscillator.start(start)
    oscillator.stop(end + 0.02)
  }
}
